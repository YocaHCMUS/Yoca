# Pricing page: giá mới + toggle tháng/năm + diff-only feature list

Ngày: 2026-07-13

## Context

Thầy phản biện yêu cầu: pricing phải có lựa chọn tháng/năm, các tier giống nhau chỉ ghi phần thay đổi. Doc `docs/plans/business/PRICING_COST_MODEL_PLAN_2026-07-13.md` mục 7.1/7.2.1 đã chốt số liệu (Lite $39 giữ nguyên, Plus $199→$79, Pro $499→$149, năm = 10× tháng) nhưng chưa áp dụng vào code — `client/src/pages/pricing/index.tsx` vẫn hiển thị giá cũ, không có toggle tháng/năm, mỗi card lặp lại full feature list thay vì chỉ ghi diff (đúng vấn đề "chật" trong screenshot user gửi).

Phiên trước đã đổi `STRIPE_PRICE_PLUS`/`STRIPE_PRICE_PRO` trong `server/.env` sang 2 Price ID mới ($79/$149 tháng). Việc còn lại: sửa UI hiển thị giá mới, thêm toggle tháng/năm **bắt thật** qua Stripe (đã hỏi user, chọn bắt thật thay vì chỉ hiển thị), diff-only feature list, giữ nguyên cấu trúc 3-slot hiện tại (card 1 vẫn toggle ẩn Free/Lite — user chọn giữ, không tách 4 card riêng).

User đã tự tạo sẵn 3 Stripe Price object năm trên dashboard (test-mode):
```
Lite yearly: price_1Tsg1ICgG4ygTBCWJOnOxbmy
Plus yearly: price_1Tsg1gCgG4ygTBCWMakzJf0a
Pro yearly:  price_1Tsg20CgG4ygTBCWAVB8W2JB
```
→ không cần chạy script tạo Price, chỉ cần dán thẳng vào `.env`.

## Phát hiện quan trọng (đã verify khớp code thật)

- **Không có Stripe Checkout Session** trong codebase — flow là custom SetupIntent (2 bước: `POST /setup-intent` → `stripe.confirmSetup()` client-side → `POST /activate-subscription`). Không có khái niệm interval ở đâu cả hiện tại.
- Stripe Price ID cố định 1 interval/ID (không dùng `price_data` inline) — đây là lý do cần Price object năm riêng, không thể tính giá năm bằng cách nhân số hiển thị.
- `subscriptions` DB table (`server/src/db/payment.ts:31-47`) không có cột interval — không cần migrate DB, interval chỉ tồn tại ngầm qua Price ID đang gắn trên Stripe subscription.
- Route `/upgrade-preview` và `/upgrade` (đổi tier từ trang account) **không bắt buộc** gửi `interval` — nếu thiếu phải tự suy ra interval hiện tại từ Price ID cũ của subscription, tránh bug: user đang trả theo năm mà đổi tier bị rớt về tháng.
- Phát hiện phụ (sửa luôn vì đang đụng vùng này): `ProfileSubscriptionsTab.tsx` có fallback hardcode cents cũ (`3900/19900/49900`) đã sai từ khi đổi giá Plus/Pro phiên trước — sửa thành `3900|39000 / 7900|79000 / 14900|149000`.
- Ngoài phạm vi, chỉ flag không sửa: thanh toán Solana (`SolanaPaymentFlow`) không có khái niệm interval — chọn "Năm" rồi trả Solana vẫn tính giá tháng quy đổi SOL. Nút "Try For Free" ở card Standard vẫn không có `onClick` (bug có sẵn, không liên quan yêu cầu lần này).

## A. Env — dán 3 Price ID năm

`server/.env` thêm:
```
STRIPE_PRICE_LITE_YEARLY=price_1Tsg1ICgG4ygTBCWJOnOxbmy
STRIPE_PRICE_PLUS_YEARLY=price_1Tsg1gCgG4ygTBCWMakzJf0a
STRIPE_PRICE_PRO_YEARLY=price_1Tsg20CgG4ygTBCWAVB8W2JB
```
`server/.env.example` thêm 3 dòng placeholder rỗng tương ứng.

## B. Server — thêm interval xuyên suốt Stripe flow

**`server/src/services/stripe.service.ts`**
- Thay `getPriceIdForTier(tier)` (dòng 61-72) bằng bản có `interval`:
```ts
export type BillingInterval = "monthly" | "yearly";

const TIER_PRICE_ENV_KEYS: Record<string, { monthly: string; yearly: string }> = {
  Lite: { monthly: "STRIPE_PRICE_LITE", yearly: "STRIPE_PRICE_LITE_YEARLY" },
  Plus: { monthly: "STRIPE_PRICE_PLUS", yearly: "STRIPE_PRICE_PLUS_YEARLY" },
  Pro: { monthly: "STRIPE_PRICE_PRO", yearly: "STRIPE_PRICE_PRO_YEARLY" },
};

function getPriceIdForTier(tier: string, interval: BillingInterval = "monthly"): string {
  const envKeys = TIER_PRICE_ENV_KEYS[tier];
  if (!envKeys) throw new Error(`Unknown pricing tier: ${tier}`);
  const envKey = interval === "yearly" ? envKeys.yearly : envKeys.monthly;
  const priceId = process.env[envKey];
  if (!priceId) throw new Error(`Missing env var ${envKey} (tier=${tier}, interval=${interval})`);
  return priceId;
}

export function resolveIntervalFromPriceId(priceId: string | undefined): BillingInterval {
  if (!priceId) return "monthly";
  for (const { yearly } of Object.values(TIER_PRICE_ENV_KEYS)) {
    if (yearly && process.env[yearly] && priceId === process.env[yearly]) return "yearly";
  }
  return "monthly";
}
```
  (Bỏ luôn fallback `"price_lite_test"` kiểu cũ — throw rõ ràng an toàn hơn cho số tiền thật.)
- `ActivateSubscriptionOptions` (103-108) thêm `interval: BillingInterval`; `activateSubscription` (120) gọi `getPriceIdForTier(opts.tier, opts.interval)`, thêm `interval: opts.interval` vào `metadata` (137-140).
- `previewSubscriptionUpgrade(subscriptionId, newTier)` (166) và `upgradeSubscription(subscriptionId, newTier, prorationDate?)` (194) đều thêm param **optional** `interval?: BillingInterval` cuối cùng; bên trong, resolve:
  ```ts
  const resolvedInterval = interval ?? resolveIntervalFromPriceId(subscription.items.data[0]?.price?.id);
  ```
  rồi dùng `getPriceIdForTier(newTier, resolvedInterval)` thay vì `getPriceIdForTier(newTier)`.

**`server/src/services/subscription.service.ts`** — `mapTierFromPriceId` (228-236) thêm check cả yearly:
```ts
function mapTierFromPriceId(priceId: string | undefined): "Lite" | "Plus" | "Pro" | undefined {
  if (!priceId) return undefined;
  if (priceId === process.env.STRIPE_PRICE_LITE || priceId === process.env.STRIPE_PRICE_LITE_YEARLY) return "Lite";
  if (priceId === process.env.STRIPE_PRICE_PLUS || priceId === process.env.STRIPE_PRICE_PLUS_YEARLY) return "Plus";
  if (priceId === process.env.STRIPE_PRICE_PRO || priceId === process.env.STRIPE_PRICE_PRO_YEARLY) return "Pro";
  return undefined;
}
```
Hàm này resolve tier cho cả webhook (`upsertSubscription`) lẫn payment-history (`resolvePlanFromInvoice`) — sửa 1 chỗ là đủ.

**`server/src/routes/payment.route.ts`** — 4 endpoint:
- `POST /setup-intent` (schema dòng 40-43): thêm `interval: z.enum(["monthly", "yearly"]).default("monthly")`; destructure thêm ở dòng 55 (chỉ log/pass-through, endpoint này không chạm price ID).
- `POST /activate-subscription` (schema 124-127): thêm `interval` cùng enum/default; dòng 140 destructure thêm `interval`; dòng 155-160 truyền `interval` vào `activateSubscription({...})`.
- `POST /upgrade-preview` (schema 365-368): thêm `interval: z.enum(["monthly", "yearly"]).optional()` (**optional**, không default, để phân biệt "không gửi" = giữ nguyên interval cũ); dòng 373 destructure, dòng 399 truyền `previewSubscriptionUpgrade(subscriptionId, newTier, interval)`.
- `POST /upgrade` (schema 418-422): thêm `interval` optional tương tự; dòng 428 destructure, dòng 465-467 truyền `upgradeSubscription(subscriptionId, newTier, prorationDate, interval)`.

## C. Client — toggle tháng/năm + thread interval vào Stripe

**`client/src/pages/pricing/index.tsx`**
- Đổi tier data sang số gốc, tính cả 2 interval từ 1 số (tránh lệch số):
  ```ts
  const LITE_DATA = { name: "Lite", monthlyPrice: 39 };
  const PLUS_TIER = { name: "Plus", monthlyPrice: 79, isMostPopular: true, accentColor: "#7C3AED" as const };
  const PRO_TIER = { name: "Pro", monthlyPrice: 149, isMostPopular: false, accentColor: "#7C3AED" as const };
  ```
- Thêm state mới cạnh `isStandard` (dòng 78): `const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");` + helper `priceForInterval(monthly) = billingInterval === "yearly" ? monthly * 10 : monthly`.
- `localizedLite`/`localizedPlus`/`localizedPro` tính `price`/`period` theo `priceForInterval` + `billingInterval` thay vì hardcode string cũ. `localizedStandard` (Free) không đổi — period luôn `undefined`.
- Thêm 1 segmented toggle **mới, độc lập** với pill toggle Standard/Lite trong card 1 — chèn giữa header (hết ở dòng 254) và Cards Grid (bắt đầu dòng 257), dùng chung style hệ thống sẵn có (`--landing-card-border`, `--landing-card-bg`, accent `#7C3AED`).
- `selectedTier`/`handleBuyNow` (154, 176-183) và `<PaymentModalWrapper>` (424-429) thêm `interval={billingInterval}`.

**`client/src/components/payment/PaymentModalWrapper.tsx`** — `PaymentModalWrapperProps` (15-20) thêm `interval: "monthly" | "yearly"`; truyền xuống `<CheckoutForm interval={interval} ... />` (166-174).

**`client/src/components/payment/CheckoutForm.tsx`** — `CheckoutFormProps` (8-16) thêm `interval`; 2 chỗ gọi API:
```ts
// dòng 79-84
json: { tier: tierKey, interval, paymentMethod: activeMethod === "bank" ? "us_bank_account" : "card" },
// dòng 137-139
json: { paymentMethodId, tier: tierKey, interval },
```
Route dùng Hono RPC typed client (`client.api.payment[...]`) nên type tự cập nhật theo schema server ở phần B, không cần sửa file type riêng.

**Fix phụ (đang đụng vùng payment)**: `client/src/components/profile/ProfileSubscriptionsTab.tsx`, hàm `resolvePlanLabel` (~511-514) — cents fallback cũ `3900/19900/49900` sai từ phiên đổi giá trước, sửa thành `3900|39000 / 7900|79000 / 14900|149000` (chấp nhận cả tháng lẫn năm).

## D. Diff-only feature list (theo đúng bảng 7.1 doc business, không bịa copy mới)

`PricingFeatures` (dòng 44-72) thêm prop `intro?: string` optional, render 1 dòng in đậm phía trên list nếu có (`"Everything in {tier}, plus:"`). 3 card gọi thêm `intro={...}`.

Nội dung từng tier (Free = baseline đầy đủ, Lite = diff vs Free, Plus = diff vs Lite, Pro = diff vs Plus):
- **Free/Standard**: giữ nguyên full list như hiện tại — không có gì "trước" nó để diff.
- **Lite**: `intro = "Everything in Standard, plus:"`, chỉ liệt kê 4 dòng quota tăng (20/20/20/25) + `dailyReset` — bỏ 2 dòng "Wallet AI Analysis: Plus required"/"Wash Trading AI Analysis: Plus required" vì không đổi so với Free.
- **Plus**: `intro = "Everything in Lite, plus:"`, quota đồng loạt 50 + 2 dòng feature mới unlock (Wallet AI Analysis, Wash Trading AI Analysis) đánh dấu "(NEW)".
- **Pro**: `intro = "Everything in Plus, plus:"`, quota đồng loạt 100 (không có capability mới, chỉ tăng số, không cần "(NEW)").

`dailyReset` giữ ở mọi tier (disclaimer chung, không phải feature row theo tier).

`aiFeature` helper (80-89) thêm 2 key union mới: `walletAiAnalysisNew`, `washTradingAiAnalysisNew`.

## E. i18n — `en.ts` (364-397) và `vi.ts` (324-357), thêm đồng thời cả 2 file

- `period.year` (mới, cạnh `period.month`).
- `toggle: { monthly, yearly, yearlyBadge }` — badge kiểu "2 months free" / "Tương đương 2 tháng miễn phí".
- `features.everythingIn: "Everything in {{$tier}}, plus:"` (dùng đúng cú pháp interpolation `{{$var}}` đã có sẵn, ví dụ `askYoca: "...{{$count}}..."`).
- `features.walletAiAnalysisNew` / `washTradingAiAnalysisNew`: text như hiện có + hậu tố "(NEW)"/"(MỚI)".

`vi.ts`'s type phải khớp `BaseTranslation` (suy ra từ `en.ts`) — thiếu key nào bên vi sẽ lỗi type, nhớ thêm đủ cả 2 file cùng lúc.

## Ngoài phạm vi (đã xác nhận không làm)

- Không đổi hiển thị sang VND — giữ USD như hiện tại (`currency: "usd"` hardcode ở `PaymentModalWrapper.tsx:148` không đổi).
- Không sửa nút "Try For Free" thiếu `onClick` (bug có sẵn, không liên quan).
- Không mở rộng interval cho luồng Solana — flag rõ trong code rằng Solana vẫn tính giá tháng bất kể toggle.
- Không migrate schema `subscriptions` (đã xác nhận không cần).

## Thứ tự thực hiện

1. Dán 3 env var năm vào `server/.env` + placeholder rỗng vào `.env.example`.
2. Phần B (server: `stripe.service.ts` → `subscription.service.ts` → `payment.route.ts`) — theo đúng thứ tự vì các hàm sau phụ thuộc chữ ký hàm trước.
3. Phần C (client: `pricing/index.tsx` → `PaymentModalWrapper.tsx` → `CheckoutForm.tsx`) + fix phụ `ProfileSubscriptionsTab.tsx`.
4. Phần D (diff-only content) — làm cùng lúc với C vì cùng file `pricing/index.tsx`.
5. Phần E (i18n) — thêm key trước khi dùng trong D để tránh lỗi type khi build.

## Verification

- `npx tsc --noEmit` ở cả `server/` và `client/` sau mỗi phần lớn.
- Chạy dev server, vào `/pricing`: bấm toggle Năm/Tháng — giá 3 tier đổi đúng 10× ($390/$790/$1490), feature list mỗi card chỉ còn diff-only + dòng "Everything in X, plus:".
- Test checkout thật (test-mode): chọn Năm, Buy Now Lite, thẻ test `4242 4242 4242 4242` → xác nhận trên Stripe dashboard subscription gắn đúng Price năm (giá gấp 10 lần), xác nhận `subscriptions` DB row `planTier="Lite"` đúng (tier resolve không phụ thuộc interval).
- Test flow upgrade từ account settings với subscription đang ở Price năm, gọi `/upgrade-preview` không gửi `interval` — xác nhận preview tính theo giá năm của tier mới, không tự rớt về tháng.
- Trigger `customer.subscription.created` qua Stripe CLI (`stripe trigger`) với price năm, xác nhận webhook → `upsertSubscription` → `mapTierFromPriceId` resolve đúng tier.
