
import { GoogleGenAI, Type } from "@google/genai";
import { TaxRecord } from "./types";
import { START_YEAR, END_YEAR } from "./constants";

// Use process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const taxRecordSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      nama: { type: Type.STRING, description: "Nama Wajib Pajak" },
      nop: { type: Type.STRING, description: "Nomor Objek Pajak" },
      arrears: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            year: { type: Type.INTEGER },
            kurangBayar: { type: Type.NUMBER, description: "Nilai dari kolom Kurang Bayar" }
          },
          required: ["year", "kurangBayar"]
        }
      }
    },
    required: ["nama", "nop", "arrears"]
  }
};

export async function processTaxPDF(fileBase64: string, mimeType: string): Promise<TaxRecord[]> {
  // Use gemini-3-pro-preview for complex extraction and arithmetic validation tasks
  const model = "gemini-3-pro-preview";
  
  const prompt = `
    Extract regional tax arrears data from this PBB-P2 document.
    1. Identify the 'Nama Wajib Pajak' (Nama) and 'Nomor Objek Pajak' (NOP).
    2. Extract all yearly records. Use the value from the 'Kurang Bayar' column.
    3. If 'Kurang Bayar' is 0, record it as 0.
    4. Normalize the data. If a year is missing in the PDF, do not invent it, just provide the ones that exist.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: prompt },
        { inlineData: { data: fileBase64, mimeType } }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: taxRecordSchema
    }
  });

  const rawData = JSON.parse(response.text || "[]");
  
  return rawData.map((item: any) => {
    const arrearsMap: Record<number, number | null> = {};
    
    // Initialize years
    for (let y = START_YEAR; y <= END_YEAR; y++) {
      arrearsMap[y] = null;
    }

    // Fill with extracted data
    item.arrears.forEach((a: any) => {
      if (a.year >= START_YEAR && a.year <= END_YEAR) {
        arrearsMap[a.year] = a.kurangBayar;
      }
    });

    // Calculate total: sum of values > 0
    const total = Object.values(arrearsMap).reduce((sum: number, val) => {
      return sum + (val !== null && val > 0 ? val : 0);
    }, 0);

    return {
      nama: item.nama,
      nop: item.nop,
      arrears: arrearsMap,
      total,
      notes: []
    };
  });
}
