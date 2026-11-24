import { GoogleGenAI } from '@google/genai';
import { AggregatedWeeklyMetrics } from '../aggregator/dataAggregator.js';
import { loadConfig } from '../config/env.js';
import { AiAuditAnalysisResult, generateRuleBasedAnalysis } from './ruleBasedFallback.js';

export async function analyzeWeeklyMetrics(data: AggregatedWeeklyMetrics): Promise<AiAuditAnalysisResult> {
  const config = loadConfig();
  const fallback = generateRuleBasedAnalysis(data);

  if (!config.geminiApiKey) {
    console.log('[Gemini Analyst] GEMINI_API_KEY tidak ditemukan. Menggunakan Rule-Based Fallback Engine.');
    return fallback;
  }

  try {
    console.log('[Gemini Analyst] Menghubungi Google Gemini 2.5 Flash API...');
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const prompt = `Anda adalah Senior IT Infrastructure & Security Auditor untuk GAJIANICH (PT Cahaya Mas Cemerlang).
Evaluasi telemetri mingguan server berikut:
${JSON.stringify(data, null, 2)}

ATURAN PENULISAN WAJIB (ANTI-SLOP & HUMAN UX-COPY):
1. DILARANG KERAS menggunakan kata klise AI: "revolusioner", "seamless", "menyelami", "tonggak sejarah", "landscape", "empower", "elevate", "unlock", "solutif menyeluruh".
2. Tulis dalam Bahasa Indonesia formal teknis operator DevOps: padat, lugas, mengutamakan angka kuantitatif (persentase, byte, hitungan).
3. Buat 3 rekomendasi prioritas dengan judul menggunakan kata kerja aktif (maksimal 4 kata).
4. Sediakan Action Items yang memuat PIC teknis spesifik (DevOps, Sysadmin, DBA, Backend Lead).

Kembalikan format JSON murni:
{
  "overallStatus": "NORMAL" | "WARNING" | "CRITICAL",
  "slaPercent": "99.95",
  "executiveSummary": "Paragraf ringkasan eksekutif formal (3-4 kalimat).",
  "incidentRca": "Analisis akar masalah jika ada lonjakan atau restart, tulis null jika normal.",
  "recommendations": [
    {
      "priority": "TINGGI" | "SEDANG" | "RENDAH",
      "title": "Judul rekomendasi singkat",
      "action": "Tindakan teknis terarah"
    }
  ],
  "actionItems": [
    {
      "no": 1,
      "issue": "Isu atau temuan",
      "action": "Tindakan perbaikan",
      "pic": "DevOps" | "Sysadmin" | "DBA" | "Backend Lead",
      "target": "W48 (Target waktu)",
      "status": "SELESAI" | "DALAM_PROGRES" | "TERJADWAL"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text?.trim() || '';
    if (!responseText) {
      throw new Error('Respon Gemini API kosong.');
    }

    const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      ...fallback,
      overallStatus: parsed.overallStatus || fallback.overallStatus,
      slaPercent: parsed.slaPercent || fallback.slaPercent,
      executiveSummary: parsed.executiveSummary || fallback.executiveSummary,
      incidentRca: parsed.incidentRca !== undefined ? parsed.incidentRca : fallback.incidentRca,
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
        ? parsed.recommendations.slice(0, 3)
        : fallback.recommendations,
      actionItems: Array.isArray(parsed.actionItems) && parsed.actionItems.length > 0
        ? parsed.actionItems
        : fallback.actionItems,
    };
  } catch (err: any) {
    console.warn(`[Gemini Analyst] Peringatan: API Gemini gagal (${err?.message || err}). Beralih otomatis ke Rule-Based Fallback Engine.`);
    return fallback;
  }
}
