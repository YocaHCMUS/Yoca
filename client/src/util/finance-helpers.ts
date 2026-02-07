// client/src/util/finance-helpers.ts

export interface OHLCData {
    time: string;
    open: number;
    close: number;
    low: number;
    high: number;
    vol: number;
}

/**
 * Hàm này giả lập dữ liệu Nến từ dữ liệu đường (Line)
 * Trong thực tế, Backend cần trả về đúng data này.
 */
export function convertLineToCandle(data: { unixTimestampMs: number; price: number }[]): OHLCData[] {
    if (!data || data.length === 0) return [];

    return data.map((item, index) => {
        const close = Number(item.price);

        // Giả lập: Giá Open là giá Close của cây nến trước đó
        const prevClose = index > 0 ? Number(data[index - 1].price) : close;
        const open = prevClose;

        // Giả lập High/Low dựa trên Open và Close với một chút biến động ngẫu nhiên
        const max = Math.max(open, close);
        const min = Math.min(open, close);
        const volatility = close * 0.005; // Biến động 0.5%

        const high = max + (Math.random() * volatility);
        const low = min - (Math.random() * volatility);

        // Format ngày tháng
        const date = new Date(item.unixTimestampMs);
        // Format: YYYY/MM/DD
        const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

        return {
            time: dateStr,
            open: open,
            close: close,
            low: low,
            high: high,
            vol: Math.random() * 1000 // Fake volume
        };
    });
}

// Hàm tính Moving Average (MA)
export function calculateMA(dayCount: number, data: OHLCData[]) {
    const result = [];
    for (let i = 0, len = data.length; i < len; i++) {
        if (i < dayCount) {
            result.push('-');
            continue;
        }
        let sum = 0;
        for (let j = 0; j < dayCount; j++) {
            sum += data[i - j].close;
        }
        result.push(sum / dayCount);
    }
    return result;
}
