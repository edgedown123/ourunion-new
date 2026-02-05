import { GoogleGenAI, Type } from "@google/genai";

/**
 * Helper function to safely get the AI instance.
 * Always use new GoogleGenAI({apiKey: process.env.API_KEY}); as per guidelines.
 */
const getAiInstance = () => {
  // Use process.env.API_KEY directly as required by guidelines.
  // Assume the key is pre-configured and accessible.
  try {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  } catch (e) {
    console.error("GoogleGenAI 초기화 실패:", e);
    return null;
  }
};

/**
 * Generates post content (title and body) based on a topic and board type.
 */
export const generatePostContent = async (topic: string, type: string) => {
  try {
    const ai = getAiInstance();
    if (!ai) return null;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `노동조합의 ${type} 게시판에 올릴 "${topic}"에 대한 게시글 내용을 작성해줘. 전문적이면서도 따뜻한 느낌으로 작성하고, 적절한 제목과 본문을 포함해줘. 한국어로 응답해.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING }
          },
          required: ["title", "content"],
          propertyOrdering: ["title", "content"]
        }
      }
    });
    
    // Use .text property directly (not a method call) as per guidelines.
    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    return null;
  } catch (error) {
    console.error("Gemini API Error (generatePostContent):", error);
    return null;
  }
};

/**
 * Suggests SEO keywords based on the provided content.
 */
export const suggestSEOKeywords = async (content: string): Promise<string[]> => {
  try {
    const ai = getAiInstance();
    if (!ai) return [];

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `다음 게시글 내용을 분석해서 검색 엔진 최적화(SEO)에 도움이 될만한 핵심 키워드 5개를 추천해줘. 한국어로 작성하고 JSON 배열 형태로 응답해.\n\n내용: ${content}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    
    // Use .text property directly as per guidelines.
    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    return [];
  } catch (error) {
    console.error("Gemini API Error (suggestSEOKeywords):", error);
    return [];
  }
};

/**
 * Generates a summary email for administrators about new member signups.
 */
export const generateMemberSummaryEmail = async (membersJson: string) => {
  try {
    const ai = getAiInstance();
    if (!ai) return "가입 신청자 명단 보고드립니다.";

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `다음은 노동조합 가입 신청자 명단(JSON)이야: ${membersJson}. 이 명단을 바탕으로 관리자에게 보낼 전문적이고 격식 있는 가입 현황 보고 메일 본문을 작성해줘. 메일 수신자는 edgedown@naver.com 이야.`,
    });
    // Use .text property directly as per guidelines.
    return response.text;
  } catch (error) {
    console.error("Gemini API Error (generateMemberSummaryEmail):", error);
    return "가입 신청자 명단 보고드립니다.";
  }
};