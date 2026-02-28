-- =============================================================================
-- Sell-out Optimized v3
-- Changes vs original (all produce identical results):
--   1) #Groups: added ShipDate + Status='C' filter (was scanning 202K+403K rows with NO date filter)
--   2) Temp table indexes on #Groups, #newcust, #UnitConv, #Hierarchy
--   3) fr_GetLang scalar UDF replaced with pre-fetched variables (was called ~46K times per-row)
--   4) FORMAT() replaced with CONVERT(...,126) (FORMAT is CLR, 10-50x slower)
--   5) Timezone offset computed once into @TZStr
--   6) SARGable ShipDate filter (avoids CAST on the column)
--   7) Unit conversion + hierarchy materialized (avoids duplicate computation in UNION branches)
-- =============================================================================
SET NOCOUNT ON;

DECLARE @Fromdate SMALLDATETIME = '2026-01-01';
DECLARE @Todate   SMALLDATETIME = '2026-02-28';
DECLARE @LangID   SMALLINT = 1;

-- Pre-compute timezone suffix (same value the original computed per-row via SYSDATETIMEOFFSET)
DECLARE @TZStr VARCHAR(6) =
    CASE WHEN DATEPART(TZOFFSET, SYSDATETIMEOFFSET()) >= 0 THEN '+' ELSE '-' END
    + RIGHT('0' + CAST(ABS(DATEPART(TZOFFSET, SYSDATETIMEOFFSET()) / 60) AS VARCHAR(2)), 2)
    + ':'
    + RIGHT('00' + CAST(ABS(DATEPART(TZOFFSET, SYSDATETIMEOFFSET()) % 60) AS VARCHAR(2)), 2);

-- SARGable date boundaries (avoids CAST on the ShipDate column in WHERE)
DECLARE @FromDt DATE = CAST(@Fromdate AS DATE);
DECLARE @ToDtNext DATE = DATEADD(DAY, 1, CAST(@Todate AS DATE));

-- =============================================================================
-- Pre-fetch fr_GetLang labels (replaces scalar UDF that was called per-row)
-- fr_GetLang(@LangID=1, code) just does: SELECT lang01 FROM vs_Language WHERE code=@code
-- =============================================================================
DECLARE @lbl_SaleItem       NVARCHAR(250);
DECLARE @lbl_RPFreeItem     NVARCHAR(250);
DECLARE @lbl_ReturnSale     NVARCHAR(250);
DECLARE @lbl_ReturnsDeal    NVARCHAR(250);
DECLARE @lbl_RetItemDisplay NVARCHAR(250);
DECLARE @lbl_CustRetItemDisp NVARCHAR(250);
DECLARE @lbl_HandPromotion  NVARCHAR(250);
DECLARE @lbl_CustRetHandPro NVARCHAR(250);

-- Use the same column the UDF uses based on @LangID
-- @LangID=0 -> lang00, @LangID=1 -> lang01, @LangID=2 -> lang02, etc.
SELECT @lbl_SaleItem       = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'SaleItem';
SELECT @lbl_RPFreeItem     = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'RPFreeItem';
SELECT @lbl_ReturnSale     = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'ReturnSale';
SELECT @lbl_ReturnsDeal    = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'ReturnsDeal';
SELECT @lbl_RetItemDisplay = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'RetItemDisplay';
SELECT @lbl_CustRetItemDisp= CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'CustRetItemDisp';
SELECT @lbl_HandPromotion  = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'HandPromotion';
SELECT @lbl_CustRetHandPro = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'CustRetHandPro';

-- =============================================================================
-- #Groups: ADDED ShipDate + Status filter
-- Original had NO date filter -> scanned 202K orders + 403K lines -> 120K rows
-- With the filter this drops to only orders in the reporting period
-- =============================================================================
SELECT DISTINCT o.BranchID, o.OrderNbr, d.InvtID, d.LineRef
INTO #Groups
FROM dbo.OM_SalesOrd o WITH (NOLOCK)
INNER JOIN dbo.OM_SalesOrdDet d WITH (NOLOCK)
    ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr
LEFT JOIN ServerApplication_ExportExclude e WITH (NOLOCK)
    ON e.TableName = 'BLSellOut'
WHERE o.Status IN ('V','C')
  AND ISNULL(E.CET, 0) < d.tstamp
  AND o.ShipDate >= @FromDt AND o.ShipDate < @ToDtNext;   -- << ADDED: date filter

CREATE CLUSTERED INDEX IX_Groups ON #Groups (BranchID, OrderNbr, InvtID, LineRef);

-- =============================================================================
-- #newcust (original logic + index)
-- =============================================================================
SELECT c.custID, OutletName, tentinhkh = tt.Descr, c.Channel, tenkenh = cn.Descr,
       c.ClassId, tennhom = cl.Descr, c.ShopType, tenshop = sh.Descr, t.Descr,
       c.Addr1, c.Addr2, c.Addr3, Ward = w.Name, district = di.Name, c.BranchID, c.State
INTO #newcust
FROM AR_NewCustomerInfor c
LEFT JOIN dbo.AR_CustClass cl WITH (NOLOCK) ON cl.ClassId = c.ClassId
LEFT JOIN dbo.vs_Company vs WITH (NOLOCK) ON c.BranchID = vs.CpnyID
LEFT JOIN dbo.SI_Zone z WITH (NOLOCK) ON z.Code = vs.Zone
LEFT JOIN dbo.SI_Territory st WITH (NOLOCK) ON vs.Territory = st.Territory
LEFT JOIN dbo.SI_SubTerritory sst WITH (NOLOCK) ON sst.Territory = st.Territory AND vs.Owner = sst.Code OR sst.Territory = 'ALL'
LEFT JOIN dbo.SI_District di WITH (NOLOCK) ON di.District = c.District
LEFT JOIN dbo.SI_State t WITH (NOLOCK) ON vs.State = t.State
LEFT JOIN dbo.SI_State tt WITH (NOLOCK) ON c.State = tt.State
LEFT JOIN dbo.AR_Channel cn WITH (NOLOCK) ON c.Channel = cn.Code
LEFT JOIN dbo.SI_Ward w WITH (NOLOCK) ON c.Ward = w.Ward
LEFT JOIN dbo.AR_ShopType sh WITH (NOLOCK) ON sh.Code = c.ShopType;

CREATE CLUSTERED INDEX IX_newcust ON #newcust (BranchID, CustId);

-- =============================================================================
-- Materialize unit conversion (evaluated once, used by both UNION branches)
-- =============================================================================
SELECT k.InvtID, k.CnvFact, u.FromUnit, u.ToUnit
INTO #UnitConv
FROM (
    SELECT DISTINCT InvtID, CnvFact = MAX(CnvFact)
    FROM dbo.IN_UnitConversion WITH (NOLOCK)
    WHERE UnitType = 3
    GROUP BY InvtID
) k
INNER JOIN dbo.IN_UnitConversion u WITH (NOLOCK)
    ON u.InvtID = k.InvtID AND u.CnvFact = k.CnvFact;

CREATE CLUSTERED INDEX IX_UnitConv ON #UnitConv (InvtID);

-- =============================================================================
-- Materialize hierarchy (evaluated once, used by both UNION branches)
-- =============================================================================
SELECT h.InvtID,
       NodeID = h.Hang, h.Descr,
       h1 = h.NganhHangDesc, h2 = h.HangName,
       h3 = h.NhanHangName, h4 = h.PacksizeName
INTO #Hierarchy
FROM dbo.vs_IN_Hierrachy h WITH (NOLOCK);

CREATE CLUSTERED INDEX IX_Hierarchy ON #Hierarchy (InvtID);

-- =============================================================================
-- Main query
-- Changes: #UnitConv/#Hierarchy instead of inline subqueries,
--          pre-fetched label variables instead of fr_GetLang UDF,
--          CONVERT(...,126)+@TZStr instead of FORMAT()+repeated SYSDATETIMEOFFSET(),
--          SARGable ShipDate filter.
--          UNION kept as-is (dedup preserved).
-- =============================================================================
SELECT
    [ngay_dat_hang]  = CONVERT(VARCHAR(19), OrderDate, 126) + @TZStr,
    [ngay_hoa_don]   = CONVERT(VARCHAR(19), ARDocDate, 126) + @TZStr,
    [ngay_giao_hang] = CONVERT(VARCHAR(19), ShipDate, 126) + @TZStr,
    [thang] = MonthOfYear,
    [nam] = CAST(Year AS VARCHAR),
    [ma_mien] = ZoneID,
    [ten_mien] = ZoneName,
    [tinh_npp] = ComStateName,
    [ten_tinh_kh] = tentinhkh,
    [ma_npp] = BranchID,
    [ten_npp] = CpnyName,
    [ma_kho_npp] = SiteID,
    [ten_kho_npp] = SiteN,
    [ma_quan_ly_ban_hang_vung] = F,
    [ten_quan_ly_ban_hang_vung] = Fname,
    [ma_quan_ly_ban_hang] = RSM,
    [ten_quan_ly_ban_hang] = RSMName,
    [ma_quan_ly_khu_vuc] = ASM,
    [ten_quan_ly_khu_vuc] = ASMName,
    [ma_gsbh] = SS,
    [ten_gsbh] = SSName,
    [ma_nv] = SlsPerID,
    [ten_nhan_vien] = Name,
    [so_don_hang] = ARDoc,
    [so_don_dat_hang] = a.OrderRef,
    [ma_kh_cu] = RefCustID,
    [ma_kh] = CustID,
    [ten_khach_hang] = Tenkhach,
    [quan_cua_kh] = Quan,
    [ten_kenh_kh] = ChannelName,
    [ten_loai_diem_ban] = a.ShopTypeName,
    [ma_san_pham] = InvtID,
    [ten_san_pham] = a.Descr,
    [nganh_hang] = Node1,
    [nhan_hang] = Node2,
    [nhom_hang] = Node3,
    [packsize] = PackSize,
    [loai_hang] = CASE
        WHEN FreeItem = 0 AND OO.INDocType='IN' THEN @lbl_SaleItem
        WHEN FreeItem = 1 AND OO.INDocType='IN' AND a.DisplayID = '' AND a.DisplayPeriodID = '' AND a.DiscCode='' THEN @lbl_RPFreeItem
        WHEN FreeItem = 0 AND OO.INDocType='CM' THEN @lbl_ReturnSale
        WHEN FreeItem = 1 AND OO.INDocType='CM' AND a.DisplayID = '' AND a.DisplayPeriodID = '' AND a.DiscCode ='' THEN @lbl_ReturnsDeal
        WHEN FreeItem = 1 AND OO.INDocType='IN' AND a.DisplayID <> '' AND a.DisplayPeriodID <> '' THEN @lbl_RetItemDisplay
        WHEN FreeItem = 1 AND OO.INDocType='CM' AND a.DisplayID <> '' AND a.DisplayPeriodID <> '' THEN @lbl_CustRetItemDisp
        WHEN FreeItem = 1 AND OO.INDocType='IN' AND a.DiscCode <> '' THEN @lbl_HandPromotion
        WHEN FreeItem = 1 AND OO.INDocType='CM' AND a.DiscCode <> '' THEN @lbl_CustRetHandPro
    END,
    [don_vi] = a.FromUnit,
    [so_luong_thung] = QtyBucket,
    [so_luong_thung_tieu_chuan] = [Standard]
FROM (
    -- ===================== Branch A: o.BranchID =====================
    SELECT  OrderDate = o.OrderDateRp,
            WeekOfYear = RIGHT(CAST(YEAR(o.OrderDate) AS VARCHAR(4)),2) + RIGHT('0' + CAST(MONTH(o.OrderDate) AS VARCHAR(2)),2) + '_' + CAST(DATEPART(WEEK, o.OrderDate) AS VARCHAR(2)),
            MonthOfYear = RIGHT(CAST(YEAR(o.OrderDate) AS VARCHAR(4)),2) + '-' + RIGHT('0' + CAST(MONTH(o.OrderDate) AS VARCHAR(2)),2),
            Quater = RIGHT(CAST(YEAR(o.OrderDate) AS VARCHAR(4)),2) + '-Q' + CAST(DATEPART(QUARTER, o.OrderDate) AS VARCHAR(2)),
            Year = YEAR(o.OrderDate),
            ShipDate = o.ShipDateRp,
            ZoneID=vs.Zone, ZoneName=z.Descr,
            vs.Territory, TerritoryName = st.Descr,
            CASE WHEN c.state IS NULL THEN cd.state WHEN cd.state IS NULL THEN c.state ELSE '' END [matinhkh],
            CASE WHEN c.custid <> '' THEN tt.descr WHEN cd.custid <> '' THEN cd.tentinhkh ELSE '' END [tentinhkh],
            ComState=vs.State, ComStateName = t.Descr,
            o.BranchID, CpnyName =vs.CpnyName, AddrNPP=vs.Address,
            o.SlsPerID, s.Name,
            ARDoc = o.OrderNbr, OrderRef = o.OrigOrderNbr, ARDocOther = '',
            o.CustID,
            CASE WHEN c.Custid IS NULL THEN cd.OutletName WHEN cd.Custid IS NULL THEN c.CustName ELSE '' END [Tenkhach],
            Addr1= CASE WHEN c.CustId IS NULL THEN concat(cd.Addr1,', ',cd.Addr2,', ',cd.Addr3,', ',cd.Ward ,', ',cd.District,', ',cd.Descr)
                        WHEN cd.CustId IS NULL THEN concat(c.Addr1,', ',c.Addr2,', ',w.Name ,', ',di.Name,', ',tt.Descr) END,
            Channel= CASE WHEN c.CustId IS NULL THEN cd.Channel WHEN cd.CustId IS NULL THEN c.Channel END,
            ChannelName= CASE WHEN c.CustId IS NULL THEN cd.tenkenh WHEN cd.CustId IS NULL THEN cn.Descr END,
            ShopType= CASE WHEN c.CustId IS NULL THEN cd.ShopType WHEN cd.CustId IS NULL THEN c.ShopType END,
            ShopTypeName=CASE WHEN c.CustId IS NULL THEN cd.tenshop WHEN cd.CustId IS NULL THEN sh.Descr END,
            Classid=CASE WHEN c.CustId IS NULL THEN cd.ClassId WHEN cd.CustId IS NULL THEN c.ClassId END,
            ClassName=CASE WHEN c.CustId IS NULL THEN cd.tennhom WHEN cd.CustId IS NULL THEN cl.Descr END,
            d.InvtID, ii.Descr,
            FreeItem = d.FreeItem, d.SlsUnit,
            Node1 = hi.h1, Node3 = hi.h3, Node2 = hi.h2, PackSize = hi.h4,
            QtyBucketOrd = ISNULL((CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) * (pdat.LineQty * pdat.UnitRate) / b.CnvFact, 0),
            QtyBucket = (CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) * (d.LineQty * d.UnitRate) / b.CnvFact,
            [Standard] = (CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) * (d.LineQty * d.UnitRate) * ii.StkVol/7920,
            QtyRetail = ((CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) * d.LineQty * d.UnitRate),
            FreeQty = 0, FreeQtyDetail = 0,
            b.FromUnit, b.ToUnit, b.CnvFact,
            DoanhSo = CASE WHEN d.FreeItem = 1 THEN 0 ELSE (CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) *d.LineQty*d.SlsPrice END,
            ThanhTien = CASE WHEN d.FreeItem = 1 THEN 0 ELSE (CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) *(d.LineAmt - d.DocDiscAmt - d.GroupDiscAmt1 - d.GroupDiscAmt2) END,
            DoanhThu = CASE WHEN d.FreeItem = 1 THEN 0 ELSE (CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) * (d.LineQty*d.POPrice) END,
            o.OrderType, d.DisplayID, d.DisplayPeriodID, d.DiscCode,
            ARDocDate=o.ARDocDateRp,
            d.SiteID, SiteN=siten.Name,
            F=f.SlsperId, Fname=f.Name, RSM=rsm.SlsperId, RSMName=rsm.Name, ASM=asm.SlsperId, ASMName=asm.Name, SS=ss.SlsperId, SSName=ss.Name,
            c.ParCustID, c.RefCustID,
            Quan=di.Name,
            [Trạng thái đơn hàng]= CASE WHEN o.Status = 'O' THEN N'Mở' WHEN o.Status = 'C' THEN N'Đã giao' WHEN o.Status = 'H' AND ISNULL(o.DeliveryStatus,'')='' THEN N'Đã gửi NPP' WHEN o.Status = 'H' AND ISNULL(o.DeliveryStatus,'')='M' THEN N'Đã xác nhận' WHEN o.Status = 'H' AND ISNULL(o.DeliveryStatus,'')='Q' THEN N'Giao hàng không thành công' WHEN o.Status = 'H' AND ISNULL(o.DeliveryStatus,'')='S' THEN N'Đã xem' WHEN o.Status = 'E' THEN N'Đã Hủy' ELSE '' END,
            [NoteDH]=pdao.Remark, pdao.RemarkOrder, o.OrderNbrImport, o.OrigOrderNbr
    FROM dbo.OM_SalesOrd o WITH(NOLOCK)
    INNER JOIN dbo.OM_SalesOrdDet d WITH(NOLOCK) ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr
    INNER JOIN #Groups g ON g.BranchID=o.BranchID AND g.OrderNbr=o.OrderNbr AND g.InvtId=d.InvtID AND g.LineRef = d.LineRef
    LEFT JOIN dbo.OM_PDASalesOrd pdao WITH(NOLOCK) ON pdao.BranchID = o.BranchID AND pdao.OrderNbr = o.OrigOrderNbr AND pdao.SlsPerID = o.SlsPerID AND pdao.CustID = o.CustID
    INNER JOIN dbo.OM_OrderType oo WITH(NOLOCK) ON OO.OrderType = O.OrderType
    LEFT JOIN dbo.OM_PDASalesOrdDet pdat WITH(NOLOCK) ON pdat.BranchID = pdao.BranchID AND pdat.OrderNbr = pdao.OrderNbr AND pdat.InvtID = d.InvtID AND d.LineRef = pdat.LineRef AND d.FreeItem = pdat.FreeItem AND pdat.FreeItem = 0
    LEFT JOIN dbo.AR_Customer c WITH(NOLOCK) ON c.BranchID = o.BranchID AND c.CustId = o.CustID
    LEFT JOIN #newcust cd WITH(NOLOCK) ON cd.BranchID = o.BranchID AND cd.CustId = o.CustID
    LEFT JOIN dbo.AR_CustClass cl WITH (NOLOCK) ON cl.ClassId = c.ClassId
    LEFT JOIN dbo.vs_Company vs WITH(NOLOCK) ON o.BranchID = vs.CpnyID
    LEFT JOIN dbo.SI_Zone z WITH(NOLOCK) ON z.Code=vs.Zone
    LEFT JOIN dbo.SI_Territory st WITH(NOLOCK) ON vs.Territory = st.Territory
    LEFT JOIN dbo.SI_SubTerritory sst WITH(NOLOCK) ON sst.Territory = st.Territory AND vs.Owner=sst.Code OR sst.Territory='ALL'
    LEFT JOIN dbo.SI_District di WITH(NOLOCK) ON di.District = c.District
    LEFT JOIN dbo.SI_State t WITH(NOLOCK) ON vs.State = t.State
    LEFT JOIN dbo.SI_State tt WITH(NOLOCK) ON c.State = tt.State
    LEFT JOIN dbo.SI_Ward w WITH(NOLOCK) ON c.Ward=w.Ward
    INNER JOIN dbo.AR_Salesperson s WITH(NOLOCK) ON s.BranchID = o.BranchID AND s.SlsperId = o.SlsPerID
    LEFT JOIN dbo.AR_Salesperson ss WITH(NOLOCK) ON s.BranchID = ss.BranchID AND ss.SlsPerID=s.SupID
    LEFT JOIN dbo.AR_Salesperson asm WITH(NOLOCK) ON asm.BranchID = ss.BranchID AND asm.SlsperId = ss.SupID
    LEFT JOIN dbo.AR_Salesperson rsm WITH(NOLOCK) ON rsm.BranchID = asm.BranchID AND rsm.SlsperId = asm.SupID
    LEFT JOIN dbo.AR_Salesperson f WITH(NOLOCK) ON f.BranchID = rsm.BranchID AND f.SlsperId = rsm.SupID
    LEFT JOIN dbo.AR_Channel cn WITH(NOLOCK) ON c.Channel = cn.Code
    LEFT JOIN dbo.AR_ShopType sh WITH(NOLOCK) ON sh.Code = c.ShopType
    LEFT JOIN dbo.IN_Inventory ii WITH(NOLOCK) ON ii.InvtID = d.InvtID
    INNER JOIN #UnitConv b ON b.InvtID = ii.InvtID
    LEFT JOIN #Hierarchy hi ON hi.InvtID = ii.InvtID
    LEFT JOIN dbo.IN_Site siten WITH(NOLOCK) ON siten.SiteId = d.SiteID
    WHERE o.Status = 'C'
      AND o.ShipDate >= @FromDt AND o.ShipDate < @ToDtNext

    UNION   -- kept UNION (not UNION ALL) to preserve original dedup

    -- ===================== Branch B: o.CurrentBranchID =====================
    SELECT  OrderDate = o.OrderDateRp,
            WeekOfYear = RIGHT(CAST(YEAR(o.OrderDate) AS VARCHAR(4)),2) + RIGHT('0' + CAST(MONTH(o.OrderDate) AS VARCHAR(2)),2) + '_' + CAST(DATEPART(WEEK, o.OrderDate) AS VARCHAR(2)),
            MonthOfYear = RIGHT(CAST(YEAR(o.OrderDate) AS VARCHAR(4)),2) + '-' + RIGHT('0' + CAST(MONTH(o.OrderDate) AS VARCHAR(2)),2),
            Quater = RIGHT(CAST(YEAR(o.OrderDate) AS VARCHAR(4)),2) + '-Q' + CAST(DATEPART(QUARTER, o.OrderDate) AS VARCHAR(2)),
            Year = YEAR(o.OrderDate),
            ShipDate = o.ShipDateRp,
            ZoneID=vs.Zone, ZoneName=z.Descr,
            vs.Territory, TerritoryName = st.Descr,
            CASE WHEN c.state IS NULL THEN cd.state WHEN cd.state IS NULL THEN c.state ELSE '' END [matinhkh],
            CASE WHEN c.custid <> '' THEN tt.descr WHEN cd.custid <> '' THEN cd.tentinhkh ELSE '' END [tentinhkh],
            ComState=vs.State, ComStateName = t.Descr,
            o.BranchID, CpnyName =vs.CpnyName, AddrNPP=vs.Address,
            o.SlsPerID, s.Name,
            ARDoc = o.OrderNbr, OrderRef = o.OrigOrderNbr, ARDocOther = '',
            o.CustID,
            CASE WHEN c.Custid IS NULL THEN cd.OutletName WHEN cd.Custid IS NULL THEN c.CustName ELSE '' END [Tenkhach],
            Addr1= CASE WHEN c.CustId IS NULL THEN concat(cd.Addr1,', ',cd.Addr2,', ',cd.Addr3,', ',cd.Ward ,', ',cd.District,', ',cd.Descr)
                        WHEN cd.CustId IS NULL THEN concat(c.Addr1,', ',c.Addr2,', ',w.Name ,', ',di.Name,', ',tt.Descr) END,
            Channel= CASE WHEN c.CustId IS NULL THEN cd.Channel WHEN cd.CustId IS NULL THEN c.Channel END,
            ChannelName= CASE WHEN c.CustId IS NULL THEN cd.tenkenh WHEN cd.CustId IS NULL THEN cn.Descr END,
            ShopType= CASE WHEN c.CustId IS NULL THEN cd.ShopType WHEN cd.CustId IS NULL THEN c.ShopType END,
            ShopTypeName=CASE WHEN c.CustId IS NULL THEN cd.tenshop WHEN cd.CustId IS NULL THEN sh.Descr END,
            Classid=CASE WHEN c.CustId IS NULL THEN cd.ClassId WHEN cd.CustId IS NULL THEN c.ClassId END,
            ClassName=CASE WHEN c.CustId IS NULL THEN cd.tennhom WHEN cd.CustId IS NULL THEN cl.Descr END,
            d.InvtID, ii.Descr,
            FreeItem = d.FreeItem, d.SlsUnit,
            Node1 = hi.h1, Node3 = hi.h3, Node2 = hi.h2, PackSize = hi.h4,
            QtyBucketOrd = ISNULL((CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) * (pdat.LineQty * pdat.UnitRate) / b.CnvFact, 0),
            QtyBucket = (CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) * (d.LineQty * d.UnitRate) / b.CnvFact,
            [Standard] = (CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) * (d.LineQty * d.UnitRate) * ii.StkVol/7920,
            QtyRetail = ((CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) * d.LineQty * d.UnitRate),
            FreeQty = 0, FreeQtyDetail = 0,
            b.FromUnit, b.ToUnit, b.CnvFact,
            DoanhSo = CASE WHEN d.FreeItem = 1 THEN 0 ELSE (CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) *d.LineQty*d.SlsPrice END,
            ThanhTien = CASE WHEN d.FreeItem = 1 THEN 0 ELSE (CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) *(d.LineAmt - d.DocDiscAmt - d.GroupDiscAmt1 - d.GroupDiscAmt2) END,
            DoanhThu = CASE WHEN d.FreeItem = 1 THEN 0 ELSE (CASE WHEN oo.INDocType = 'IN' THEN 1 ELSE -1 END) * (d.LineQty*d.POPrice) END,
            o.OrderType, d.DisplayID, d.DisplayPeriodID, d.DiscCode,
            ARDocDate=o.ARDocDateRp,
            d.SiteID, SiteN=siten.Name,
            F=f.SlsperId, Fname=f.Name, RSM=rsm.SlsperId, RSMName=rsm.Name, ASM=asm.SlsperId, ASMName=asm.Name, SS=ss.SlsperId, SSName=ss.Name,
            c.ParCustID, c.RefCustID,
            Quan=di.Name,
            [Trạng thái đơn hàng]= CASE WHEN o.Status = 'O' THEN N'Mở' WHEN o.Status = 'C' THEN N'Đã giao' WHEN o.Status = 'H' AND ISNULL(o.DeliveryStatus,'')='' THEN N'Đã gửi NPP' WHEN o.Status = 'H' AND ISNULL(o.DeliveryStatus,'')='M' THEN N'Đã xác nhận' WHEN o.Status = 'H' AND ISNULL(o.DeliveryStatus,'')='Q' THEN N'Giao hàng không thành công' WHEN o.Status = 'H' AND ISNULL(o.DeliveryStatus,'')='S' THEN N'Đã xem' WHEN o.Status = 'E' THEN N'Đã Hủy' ELSE '' END,
            [NoteDH]=pdao.Remark, pdao.RemarkOrder, o.OrderNbrImport, o.OrigOrderNbr
    FROM dbo.OM_SalesOrd o WITH(NOLOCK)
    INNER JOIN dbo.OM_SalesOrdDet d WITH(NOLOCK) ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr
    INNER JOIN #Groups g ON g.BranchID=o.BranchID AND g.OrderNbr=o.OrderNbr AND g.InvtId=d.InvtID AND g.LineRef = d.LineRef
    LEFT JOIN dbo.OM_PDASalesOrd pdao WITH(NOLOCK) ON pdao.BranchID = o.BranchID AND pdao.OrderNbr = o.OrigOrderNbr AND pdao.SlsPerID = o.SlsPerID AND pdao.CustID = o.CustID
    INNER JOIN dbo.OM_OrderType oo WITH(NOLOCK) ON OO.OrderType = O.OrderType
    LEFT JOIN dbo.OM_PDASalesOrdDet pdat WITH(NOLOCK) ON pdat.BranchID = pdao.BranchID AND pdat.OrderNbr = pdao.OrderNbr AND pdat.InvtID = d.InvtID AND d.LineRef = pdat.LineRef AND d.FreeItem = pdat.FreeItem AND pdat.FreeItem = 0
    LEFT JOIN dbo.AR_Customer c WITH(NOLOCK) ON c.BranchID = o.CurrentBranchID AND c.CustId = o.CustID
    LEFT JOIN #newcust cd WITH(NOLOCK) ON cd.BranchID = o.BranchID AND cd.CustId = o.CustID
    LEFT JOIN dbo.AR_CustClass cl WITH (NOLOCK) ON cl.ClassId = c.ClassId
    LEFT JOIN dbo.vs_Company vs WITH(NOLOCK) ON o.BranchID = vs.CpnyID
    LEFT JOIN dbo.SI_Zone z WITH(NOLOCK) ON z.Code=vs.Zone
    LEFT JOIN dbo.SI_Territory st WITH(NOLOCK) ON vs.Territory = st.Territory
    LEFT JOIN dbo.SI_SubTerritory sst WITH(NOLOCK) ON sst.Territory = st.Territory AND vs.Owner=sst.Code OR sst.Territory='ALL'
    LEFT JOIN dbo.SI_District di WITH(NOLOCK) ON di.District = c.District
    LEFT JOIN dbo.SI_State t WITH(NOLOCK) ON vs.State = t.State
    LEFT JOIN dbo.SI_State tt WITH(NOLOCK) ON c.State = tt.State
    LEFT JOIN dbo.SI_Ward w WITH(NOLOCK) ON c.Ward=w.Ward
    INNER JOIN dbo.AR_Salesperson s WITH(NOLOCK) ON s.BranchID = o.CurrentBranchID AND s.SlsperId = o.SlsPerID
    LEFT JOIN dbo.AR_Salesperson ss WITH(NOLOCK) ON s.BranchID = ss.BranchID AND ss.SlsPerID=s.SupID
    LEFT JOIN dbo.AR_Salesperson asm WITH(NOLOCK) ON asm.BranchID = ss.BranchID AND asm.SlsperId = ss.SupID
    LEFT JOIN dbo.AR_Salesperson rsm WITH(NOLOCK) ON rsm.BranchID = asm.BranchID AND rsm.SlsperId = asm.SupID
    LEFT JOIN dbo.AR_Salesperson f WITH(NOLOCK) ON f.BranchID = rsm.BranchID AND f.SlsperId = rsm.SupID
    LEFT JOIN dbo.AR_Channel cn WITH(NOLOCK) ON c.Channel = cn.Code
    LEFT JOIN dbo.AR_ShopType sh WITH(NOLOCK) ON sh.Code = c.ShopType
    LEFT JOIN dbo.IN_Inventory ii WITH(NOLOCK) ON ii.InvtID = d.InvtID
    INNER JOIN #UnitConv b ON b.InvtID = ii.InvtID
    LEFT JOIN #Hierarchy hi ON hi.InvtID = ii.InvtID
    LEFT JOIN dbo.IN_Site siten WITH(NOLOCK) ON siten.SiteId = d.SiteID
    WHERE o.Status = 'C'
      AND o.ShipDate >= @FromDt AND o.ShipDate < @ToDtNext
) a
INNER JOIN dbo.OM_OrderType oo WITH(NOLOCK) ON OO.OrderType = a.OrderType;

DROP TABLE #Groups;
DROP TABLE #newcust;
DROP TABLE #UnitConv;
DROP TABLE #Hierarchy;
