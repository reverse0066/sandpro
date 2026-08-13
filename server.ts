import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON with a larger limit for base64 images/PDFs
app.use(express.json({ limit: '50mb' }));

// Gemini AI initialization helper
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    aiInstance = new GoogleGenAI({
      apiKey: apiKey || "MISSING_KEY",
      httpOptions: {
        timeout: 300000, // 5 minutes timeout for heavy OCR/PDF requests
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Helper to format Gemini API errors into clean Arabic messages
function formatGeminiError(error: any): string {
  if (!error) return "حدث خطأ غير متوقع أثناء الاتصال بالذكاء الاصطناعي.";
  const rawMsg = typeof error === 'string' ? error : (error?.message || String(error));
  
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
        if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE') {
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

// Helper to retry async operations on transient/retryable errors (e.g. Decode preempted, signal aborted, 429, 503)
async function retryOperation<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || String(err);
      console.log(`[Gemini Retry ${attempt}/${maxRetries}] ${msg.substring(0, 150)}`);
      
      // On 503 high demand / UNAVAILABLE, fail fast to switch to fallback model immediately
      if (msg.includes("503") || msg.includes("high demand") || msg.includes("UNAVAILABLE")) {
        if (attempt >= 2) {
          console.log(`[Gemini] Model high demand detected, switching immediately to fallback model...`);
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

// Helper function to call Gemini API with model fallback and retry on rate limits (429) / 404 / preemptions
async function callGeminiWithFallbackAndRetry(
  fileData: string,
  mimeType: string,
  prompt: string,
  fileName?: string,
  models = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"]
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  
  const ai = getAI();
  let lastError: any = null;
  
  for (const modelName of models) {
    try {
      console.log(`[Gemini OCR] Attempting extraction with model: ${modelName}`);
      const text = await retryOperation(async () => {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: fileData
                  }
                }
              ]
            }
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  invoiceNo: { type: Type.STRING },
                  date: { type: Type.STRING },
                  customerName: { type: Type.STRING },
                  totalWithVat: { type: Type.NUMBER },
                  totalAmount: { type: Type.NUMBER },
                  vatNo: { type: Type.STRING }
                },
                required: ["invoiceNo", "date", "customerName", "totalWithVat"]
              }
            }
          }
        });

        if (response && response.text) {
          return response.text;
        }
        throw new Error("Empty response text returned from Gemini API");
      }, 2, 1000);

      console.log(`[Gemini OCR] Successfully extracted content with ${modelName}`);
      return text;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.log(`[Gemini OCR] Model ${modelName} failed, trying next fallback: ${errMsg.substring(0, 150)}`);
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to extract data using Gemini API. All model fallbacks failed.");
}

// API endpoint for invoice extraction
app.post("/api/extract-invoice", async (req, res) => {
  try {
    const { fileData, mimeType, fileName } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: "Missing file data" });
    }

    let resolvedMimeType = mimeType;
    if (!resolvedMimeType || resolvedMimeType === '' || resolvedMimeType === 'application/octet-stream') {
      if (fileName && fileName.toLowerCase().endsWith('.pdf')) {
        resolvedMimeType = 'application/pdf';
      } else if (fileName && (fileName.toLowerCase().endsWith('.png') || fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg'))) {
        resolvedMimeType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      } else {
        resolvedMimeType = 'application/pdf';
      }
    }

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

    let text = await callGeminiWithFallbackAndRetry(fileData, resolvedMimeType, prompt, fileName);

    // Clean up markdown if present
    if (text.includes("```json")) {
      text = text.split("```json")[1].split("```")[0];
    } else if (text.includes("```")) {
      text = text.split("```")[1].split("```")[0];
    }
    
    const result = JSON.parse(text.trim());
    res.json(Array.isArray(result) ? result : [result]);
  } catch (error: any) {
    console.error("[Gemini OCR] Extraction Error:", error);
    const formattedMsg = formatGeminiError(error);
    const isRateLimit = error?.message?.includes('429') || error?.message?.includes('quota') || error?.message?.includes('resource_exhausted');
    const statusCode = isRateLimit ? 429 : 500;
    res.status(statusCode).json({ error: formattedMsg, isQuotaExceeded: isRateLimit });
  }
});

// Endpoint to check AI API status & quota availability
app.get("/api/check-ai-status", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        status: 'missing_key',
        isQuotaAvailable: false,
        message: 'مفتاح GEMINI_API_KEY غير متوفر في بيئة التشغيل.'
      });
    }

    const ai = getAI();
    // Test a minimal light prompt
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: 'فحص الرصيد والخدمة',
      config: {
        maxOutputTokens: 5,
      }
    });

    if (response && response.text) {
      return res.json({
        status: 'ok',
        isQuotaAvailable: true,
        message: 'حالة الرصيد والخدمة ممتازة وجاهزة للاستخدام بدون أي انقطاع.',
        model: 'gemini-3.7-flash',
        checkedAt: new Date().toISOString()
      });
    } else {
      return res.json({
        status: 'ok',
        isQuotaAvailable: true,
        message: 'خدمة الذكاء الاصطناعي متصلة وبحالة جيدة.',
        model: 'gemini-3.7-flash',
        checkedAt: new Date().toISOString()
      });
    }
  } catch (error: any) {
    console.error("[AI Health Check] Status error:", error);
    const rawMsg = error?.message || String(error);
    const isQuotaError = rawMsg.includes("429") || rawMsg.includes("quota") || rawMsg.includes("RESOURCE_EXHAUSTED");
    const isHighDemand = rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE");

    if (isQuotaError) {
      return res.json({
        status: 'quota_exceeded',
        isQuotaAvailable: false,
        message: '⚠️ نفاد رصيد أو حصة الاستخدام المتاحة للذكاء الاصطناعي (Quota Limit Reached / 429). يرجى التحقق من الحساب أو المحاولة لاحقاً.',
        rawError: rawMsg
      });
    } else if (isHighDemand) {
      return res.json({
        status: 'high_demand',
        isQuotaAvailable: true,
        message: '⚡ حالة الرصيد ممتازة، ولكن الخدمة تشهد ضغطاً إقليمياً مؤقتاً (503). ستقوم أتمتة النظام بالتحويل للنماذج الاحتياطية تلقائياً.',
        rawError: rawMsg
      });
    } else {
      return res.json({
        status: 'error',
        isQuotaAvailable: false,
        message: `تعذر الاتصال بالخدمة: ${formatGeminiError(error)}`,
        rawError: rawMsg
      });
    }
  }
});

// Dedicated API Endpoint for Multimodal Account Statement PDF Processing
app.post("/api/analyze-statement-pdf", async (req, res) => {
  try {
    const { fileData, mimeType, fileName } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: "بيانات الملف المرفوع مفقودة" });
    }

    let resolvedMimeType = mimeType;
    if (!resolvedMimeType || resolvedMimeType === '' || resolvedMimeType === 'application/octet-stream') {
      if (fileName && fileName.toLowerCase().endsWith('.pdf')) {
        resolvedMimeType = 'application/pdf';
      } else if (fileName && (fileName.toLowerCase().endsWith('.png') || fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg'))) {
        resolvedMimeType = fileName.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      } else {
        resolvedMimeType = 'application/pdf';
      }
    }

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

    const ai = getAI();
    const models = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
    let lastError: any = null;
    let extractedText: string | null = null;

    for (const modelName of models) {
      try {
        console.log(`[Account Statement AI] Processing with model: ${modelName}`);
        extractedText = await retryOperation(async () => {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: resolvedMimeType,
                      data: fileData
                    }
                  }
                ]
              }
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  customerName: { type: Type.STRING },
                  isCustomerConsistent: { type: Type.BOOLEAN },
                  detectedCustomers: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        invoiceNo: { type: Type.STRING },
                        date: { type: Type.STRING },
                        customerName: { type: Type.STRING },
                        description: { type: Type.STRING },
                        debit: { type: Type.NUMBER },
                        credit: { type: Type.NUMBER },
                        vatAmount: { type: Type.NUMBER }
                      },
                      required: ["invoiceNo", "date", "customerName", "debit"]
                    }
                  }
                },
                required: ["customerName", "isCustomerConsistent", "items"]
              }
            }
          });

          if (response && response.text) {
            return response.text;
          }
          throw new Error("Empty response returned from Gemini API");
        }, 2, 1000);

        if (extractedText) {
          break;
        }
      } catch (err: any) {
        console.log(`[Account Statement AI] ${modelName} failed, trying next fallback:`, err?.message || err);
        lastError = err;
      }
    }

    if (!extractedText) {
      throw lastError || new Error("فشل تحليل الملف بواسطة الذكاء الاصطناعي.");
    }

    if (extractedText.includes("```json")) {
      extractedText = extractedText.split("```json")[1].split("```")[0];
    } else if (extractedText.includes("```")) {
      extractedText = extractedText.split("```")[1].split("```")[0];
    }

    const parsedData = JSON.parse(extractedText.trim());
    res.json(parsedData);
  } catch (error: any) {
    console.error("[Account Statement AI] Endpoint error:", error);
    const formattedMsg = formatGeminiError(error);
    const is503 = error?.message?.includes('503') || error?.message?.includes('high demand') || error?.message?.includes('UNAVAILABLE');
    const statusCode = is503 ? 503 : 500;
    res.status(statusCode).json({ error: formattedMsg });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
