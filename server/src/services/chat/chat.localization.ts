function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

const MESSAGES: Record<string, Record<string, string>> = {
  en: {
    noResponse: "I'm sorry, I couldn't process your request at this time.",
    noUnderstand: "I'm sorry, I couldn't understand your question.",
    noTool: "I'm sorry, I couldn't determine how to answer that.",
    toolError: "I tried to look up the data but ran into an issue: {{error}}. Please try again or ask a different question.",
    dataError: "I found the data but couldn't generate a proper response. Please try again.",
    noData: "I can only help with questions about this wallet's on-chain data.",
    hereData: "Here's the data you requested.",
    allToolsFailed: "I tried to look up the data but ran into an issue: {{error}}. Please try again or ask a different question.",
  },
  vi: {
    noResponse: "Xin lỗi, tôi không thể xử lý yêu cầu của bạn lúc này.",
    noUnderstand: "Xin lỗi, tôi không thể hiểu câu hỏi của bạn.",
    noTool: "Xin lỗi, tôi không thể xác định cách trả lời câu hỏi đó.",
    toolError: "Tôi đã cố gắng tra cứu dữ liệu nhưng gặp lỗi: {{error}}. Vui lòng thử lại hoặc đặt câu hỏi khác.",
    dataError: "Tôi đã tìm thấy dữ liệu nhưng không thể tạo phản hồi phù hợp. Vui lòng thử lại.",
    noData: "Tôi chỉ có thể trả lời các câu hỏi về dữ liệu on-chain của ví này.",
    hereData: "Đây là dữ liệu bạn yêu cầu.",
    allToolsFailed: "Tôi đã cố gắng tra cứu dữ liệu nhưng gặp lỗi: {{error}}. Vui lòng thử lại hoặc đặt câu hỏi khác.",
  },
};

export function getMessage(language: string | undefined, key: string, vars?: Record<string, string>): string {
  const lang = language === "vi" ? "vi" : "en";
  const msg: string | undefined = MESSAGES[lang]?.[key] ?? MESSAGES["en"]?.[key] ?? key;
  if (!vars) return msg;
  return interpolate(msg, vars);
}
