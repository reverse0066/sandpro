// Cloudflare Worker — sandpro backend (converted from server.ts Express app)
// Serves /api/* routes with Gemini AI (reads GEMINI_API_KEY from Secrets)
// and falls through to static assets for everything else.

const MODELS = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept, Authorization",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

// --- Gemini REST call (replaces @google/genai SDK) ---
async function geminiGenerate(apiKey, model, parts, generationConfig) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
        "User-Agent": "aistudio-build",
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig,
      }),
    }
  );
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(JSON.stringify(data));
  }
  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("");
  if (!text) throw new Error("Empty response text returned from Gemini API");
  return text;
}

// Helper to format Gemini API errors into clean Arabic messages
function formatGeminiError(error) {
  if (!error) return "حدث خطأ غير متوقع أثناء الاتصال بالذكاء الاصطناعي.";
  const rawMsg = typeof error === "string" ? error : error?.message || String(error);

  if (rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE")) {
    return "خدمة الذكاء الاصطناعي تواجه ضغطاً كبيراً مؤقتاً على النماذج. تم تجهيز أتمتة إعادة المحاولة تلقائياً، يرجى المحاولة مرة أخرى الآن.";
  }
  if (rawMsg.includes("429") || rawMsg.includes("quota") || rawMsg.includes("RESOURCE_EXHAUSTED")) {
    return "تم تجاوز حد الاستخدام المسموح به مؤقتاً (Quota Limit). يرجى الانتظار بضع ثوانٍ ثم إعادة المحاولة.";
  }
  if (rawMsg.includes("404") || rawMsg.includes("NOT_FOUND")) {
    return "نموذج الذكاء الاصطناعي المطلوب غير متاح حالياً.";
  }

  try {
    const jsonMatch = rawMsg.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) {
        if (parsed.error.code === 503 || parsed.error.status === "UNAVAILABLE") {
          return "النموذج قيد الضغط المرتفع حالياً. يرجى إعادة المحاولة بعد بضع ثوانٍ.";
        }
        return parsed.error.message;
      }
    }
  } catch (e) {
    // Ignore JSON parsing failure
  }

  return rawMsg;
}

// Retry helper for transient errors (429, 503, aborted signals)
async function retryOperation(fn, maxRetries = 2, initialDelayMs = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = err?.message || String(err);
      console.log(`[Gemini Retry ${attempt}/${maxRetries}] ${msg.substring(0, 150)}`);

      if (msg.includes("503") || msg.includes("high demand") || msg.includes("UNAVAILABLE")) {
        if (attempt >= 2) {
          console.log("[Gemini] Model high demand detected, switching immediately to fallback model...");
          throw err;
        }
      }

      if (attempt < maxRetries) {
        const backoff = initialDelayMs + Math.floor(Math.random() * 500);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }
  }
  throw lastError;
}

// Call Gemini with model fallback + retry
async function callGeminiWithFallbackAndRetry(apiKey, fileData, mimeType, prompt, responseSchema) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  let lastError = null;

  for (const modelName of MODELS) {
    try {
      console.log(`[Gemini OCR] Attempting extraction with model: ${modelName}`);
      const text = await retryOperation(async () => {
        return await geminiGenerate(
          apiKey,
          modelName,
          [{ text: prompt }, { inlineData: { mimeType, data: fileData } }],
          { responseMimeType: "application/json", responseSchema }
        );
      }, 2, 1000);
      console.log(`[Gemini OCR] Successfully extracted content with ${modelName}`);
      return text;
    } catch (err) {
      const errMsg = err?.message || String(err);
      console.log(`[Gemini OCR] Model ${modelName} failed, trying next fallback: ${errMsg.substring(0, 150)}`);
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to extract data using Gemini API. All model fallbacks failed.");
}

function resolveMimeType(mimeType, fileName) {
  if (mimeType && mimeType !== "" && mimeType !== "application/octet-stream") return mimeType;
  const name = (fileName || "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  return "application/pdf";
}

function cleanJsonText(text) {
  if (text.includes("```json")) {
    text = text.split("```json")[1].split("```")[0];
  } else if (text.includes("```")) {
    text = text.split("```")[1].split("```")[0];
  }
  return text.trim();
}

// --- Route: POST /api/extract-invoice ---
async function handleExtractInvoice(request, env) {
  try {
    const body = await request.json();
    const { fileData, mimeType, fileName } = body;
    if (!fileData) return json({ error: "Missing file data" }, 400);

    const resolvedMimeType = resolveMimeType(mimeType, fileName);

    const prompt = `
      أنت نظام خبير في استخراج بيانات الفواتير المحاسبية باللغة العربية والإنجليزية.
      قم بمسح وقراءة هذا المستند المرفق بدقة متناهية واستخراج البيانات التالية لكل فاتورة موجودة:

      1. invoiceNo (رقم الفاتورة): استخرج رقم الفاتورة بالضبط كملف نصي (مثلاً 1913 أو 1984 أو 2091 أو INV-0012). لا تختلق أو تغير الرقم.
      2. date (تاريخ الفاتورة): استخرج تاريخ إصدار الفاتورة كما هو مطبوع المكتوب بوضوح (مثال: 2026/04/02 أو 2026-05-02 أو 02/05/2026).
      3. customerName (اسم العميل / المشتري): استخرج اسم العميل أو اسم الشركة المكتوب في حقل "السيد/السادة" أو "العميل" أو "المشتري".
      4. totalWithVat (المبلغ الإجمالي شامل ضريبة القيمة المضافة): المبلغ النهائي المستحق بعد الضريبة (الصافي النهائي شامل 15% ضريبة). اكتبه كرقم فقط بدون فواصل أو رموز عملة.
      5. totalAmount (المبلغ الصافي قبل الضريبة): الإجمالي قبل الضريبة (الصافي). اكتبه كرقم فقط.
      6. vatNo (الرقم الضريبي للعميل أو البائع إن وجد).

      تعليمات صارمة:
      - لا تخلط بين المبلغ قبل الضريبة والمبلغ الإجمالي بعد الضريبة.
      - استخرج البيانات الدقيقة المطابقة تماماً لما هو مكتوب في المستند المرفوع.
      - أرجع النتيجة على شكل مصفوفة JSON تحتوي على الأهداف المطلوبة.
    `;

    const schema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          invoiceNo: { type: "STRING" },
          date: { type: "STRING" },
          customerName: { type: "STRING" },
          totalWithVat: { type: "NUMBER" },
          totalAmount: { type: "NUMBER" },
          vatNo: { type: "STRING" },
        },
        required: ["invoiceNo", "date", "customerName", "totalWithVat"],
      },
    };

    let text = await callGeminiWithFallbackAndRetry(env.GEMINI_API_KEY, fileData, resolvedMimeType, prompt, schema);
    text = cleanJsonText(text);
    const result = JSON.parse(text);
    return json(Array.isArray(result) ? result : [result]);
  } catch (error) {
    console.error("[Gemini OCR] Extraction Error:", error);
    const formattedMsg = formatGeminiError(error);
    const isRateLimit =
      error?.message?.includes("429") ||
      error?.message?.includes("quota") ||
      error?.message?.includes("resource_exhausted");
    return json({ error: formattedMsg, isQuotaExceeded: isRateLimit }, isRateLimit ? 429 : 500);
  }
}

// --- Route: GET /api/check-ai-status ---
async function handleCheckAiStatus(env) {
  try {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return json({
        status: "missing_key",
        isQuotaAvailable: false,
        message: "مفتاح GEMINI_API_KEY غير متوفر في بيئة التشغيل.",
      });
    }

    try {
      await geminiGenerate(apiKey, "gemini-3.7-flash", [{ text: "فحص الرصيد والخدمة" }], {
        maxOutputTokens: 5,
      });
      return json({
        status: "ok",
        isQuotaAvailable: true,
        message: "حالة الرصيد والخدمة ممتازة وجاهزة للاستخدام بدون أي انقطاع.",
        model: "gemini-3.7-flash",
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      const rawMsg = error?.message || String(error);
      const isQuotaError = rawMsg.includes("429") || rawMsg.includes("quota") || rawMsg.includes("RESOURCE_EXHAUSTED");
      const isHighDemand = rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE");

      if (isQuotaError) {
        return json({
          status: "quota_exceeded",
          isQuotaAvailable: false,
          message: "⚠️ نفاد رصيد أو حصة الاستخدام المتاحة للذكاء الاصطناعي (Quota Limit Reached / 429). يرجى التحقق من الحساب أو المحاولة لاحقاً.",
          rawError: rawMsg,
        });
      } else if (isHighDemand) {
        return json({
          status: "high_demand",
          isQuotaAvailable: true,
          message: "⚡ حالة الرصيد ممتازة، ولكن الخدمة تشهد ضغطاً إقليمياً مؤقتاً (503). ستقوم أتمتة النظام بالتحويل للنماذج الاحتياطية تلقائياً.",
          rawError: rawMsg,
        });
      } else {
        return json({
          status: "error",
          isQuotaAvailable: false,
          message: `تعذر الاتصال بالخدمة: ${formatGeminiError(error)}`,
          rawError: rawMsg,
        });
      }
    }
  } catch (error) {
    return json({ status: "error", isQuotaAvailable: false, message: formatGeminiError(error) });
  }
}

// --- Route: POST /api/analyze-statement-pdf ---
async function handleAnalyzeStatementPdf(request, env) {
  try {
    const body = await request.json();
    const { fileData, mimeType, fileName } = body;
    if (!fileData) return json({ error: "بيانات الملف المرفوع مفقودة" }, 400);

    const resolvedMimeType = resolveMimeType(mimeType, fileName);

    const prompt = `
      أنت نظام محاسبي ذكي خبير في معالجة واستخراج بيانات كشوفات الحساب والفواتير المدمجة في ملفات الـ PDF باللغة العربية والإنجليزية.
      قم بمسح كافة صفحات المستند المرفق بدقة متناهية واستخراج الحركات والفواتير الموجودة بداخلها:

      المطلوب استخراجه بدقة:
      1. customerName: اسم العميل الرئيسي المذكور في الفواتير.
      2. isCustomerConsistent: قيمة منطقية (true إذا كانت جميع الفواتير تتبع لنفس العميل، أو false إذا تم رصد أسماء عملاء مختلفة).
      3. detectedCustomers: قائمة بجميع أسماء العملاء المختلفة التي تم رصدها في المستند.
      4. items: مصفوفة بجميع الفواتير أو الحركات المالية، مرتبة زمنياً من الأقدم تاريخاً إلى الأحدث تاريخاً.
         تحتوي كل حركة على:
         - invoiceNo: رقم الفاتورة أو المرجع المكتوب (مثال: 1913 أو INV-102 أو 2091).
         - date: تاريخ الحركة بصيغة YYYY-MM-DD (مثال: 2026-04-15).
         - customerName: اسم العميل المكتوب في هذه الفاتورة.
         - description: بيان توضيحي للحركة (مثال: فاتورة مبيعات رقم 1913).
         - debit: إجمالي قيمة الفاتورة شاملة الضريبة (مدين). رقم فقط بدون رموز.
         - credit: المبالغ المدفوعة أو المقبوضة إن وجدت (دائن)، أو 0 إذا لم تذكر للدفع.
         - vatAmount: قيمة ضريبة القيمة المضافة للفاتورة إن وجدت (رقم فقط).

      تعليمات صارمة:
      - يجب ترتيب الحركات تسلسلياً بحسب التاريخ من الأقدم للأحدث.
      - استخرج جميع الفواتير في الملف ولا تغفل أي فاتورة.
      - لا تضع رموز عملة أو فواصل في الأرقام.
    `;

    const schema = {
      type: "OBJECT",
      properties: {
        customerName: { type: "STRING" },
        isCustomerConsistent: { type: "BOOLEAN" },
        detectedCustomers: { type: "ARRAY", items: { type: "STRING" } },
        items: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              invoiceNo: { type: "STRING" },
              date: { type: "STRING" },
              customerName: { type: "STRING" },
              description: { type: "STRING" },
              debit: { type: "NUMBER" },
              credit: { type: "NUMBER" },
              vatAmount: { type: "NUMBER" },
            },
            required: ["invoiceNo", "date", "customerName", "debit"],
          },
        },
      },
      required: ["customerName", "isCustomerConsistent", "items"],
    };

    let extractedText = await callGeminiWithFallbackAndRetry(env.GEMINI_API_KEY, fileData, resolvedMimeType, prompt, schema);
    extractedText = cleanJsonText(extractedText);
    const parsedData = JSON.parse(extractedText);
    return json(parsedData);
  } catch (error) {
    console.error("[Account Statement AI] Endpoint error:", error);
    const formattedMsg = formatGeminiError(error);
    const is503 =
      error?.message?.includes("503") ||
      error?.message?.includes("high demand") ||
      error?.message?.includes("UNAVAILABLE");
    return json({ error: formattedMsg }, is503 ? 503 : 500);
  }
}

// --- Main fetch handler ---
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    // API routes
    if (url.pathname === "/api/check-ai-status" && request.method === "GET") {
      return handleCheckAiStatus(env);
    }
    if (url.pathname === "/api/extract-invoice" && request.method === "POST") {
      return handleExtractInvoice(request, env);
    }
    if (url.pathname === "/api/analyze-statement-pdf" && request.method === "POST") {
      return handleAnalyzeStatementPdf(request, env);
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Not Found" }, 404);
    }

    // Everything else → static assets (React frontend)
    return env.ASSETS.fetch(request);
  },
};
