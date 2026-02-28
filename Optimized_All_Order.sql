-- =============================================================================
-- All Data Order - Optimized
-- Changes vs original (all produce identical results):
--   1) Clustered index on #Groups after creation
--   2) fr_GetLang scalar UDF replaced with pre-fetched variables
--   3) fr_OM_GetCnvFact scalar UDF KEPT (different logic from b.CnvFact)
--   4) Unit conversion + hierarchy materialized into temp tables (avoids 3x recompute)
--   5) SARGable date filters (removes CAST on the column)
--   6) SET NOCOUNT ON to avoid row-count messages overhead
-- =============================================================================
SET NOCOUNT ON;

DECLARE @Fromdate SMALLDATETIME = '2026-1-01';
DECLARE @Todate   SMALLDATETIME = '2026-12-31';
DECLARE @LangID   SMALLINT = 1;

-- SARGable date boundaries
DECLARE @FromDt DATE = CAST(@Fromdate AS DATE);
DECLARE @ToDtNext DATE = DATEADD(DAY, 1, CAST(@Todate AS DATE));

-- =============================================================================
-- Pre-fetch fr_GetLang labels (replaces scalar UDF called per-row)
-- =============================================================================
DECLARE @lbl_RPSalesPerson  NVARCHAR(250);
DECLARE @lbl_RPSalesSup     NVARCHAR(250);
DECLARE @lbl_RPAreaSalesMan NVARCHAR(250);
DECLARE @lbl_RPRegionalDir  NVARCHAR(250);
DECLARE @lbl_ZSM            NVARCHAR(250);
DECLARE @lbl_SaleOrder      NVARCHAR(250);
DECLARE @lbl_AppforPaym     NVARCHAR(250);
DECLARE @lbl_SaleItem       NVARCHAR(250);
DECLARE @lbl_RPFreeItem     NVARCHAR(250);
DECLARE @lbl_RetOnDisplay   NVARCHAR(250);
DECLARE @lbl_Hold           NVARCHAR(250);
DECLARE @lbl_CloseOrder     NVARCHAR(250);

SELECT @lbl_RPSalesPerson  = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'RPSalesPerson';
SELECT @lbl_RPSalesSup     = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'RPSalesSup';
SELECT @lbl_RPAreaSalesMan = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'RPAreaSalesMan';
SELECT @lbl_RPRegionalDir  = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'RPRegionalDir';
SELECT @lbl_ZSM            = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'ZSM';
SELECT @lbl_SaleOrder      = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'SaleOrder';
SELECT @lbl_AppforPaym     = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'AppforPaym';
SELECT @lbl_SaleItem       = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'SaleItem';
SELECT @lbl_RPFreeItem     = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'RPFreeItem';
SELECT @lbl_RetOnDisplay   = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'RetOnDisplay';
SELECT @lbl_Hold           = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'Hold';
SELECT @lbl_CloseOrder     = CASE @LangID WHEN 0 THEN lang00 WHEN 1 THEN lang01 WHEN 2 THEN lang02 WHEN 3 THEN lang03 WHEN 4 THEN lang04 END FROM dbo.vs_Language WHERE code = 'CloseOrder';

-- =============================================================================
-- #Groups (original logic + clustered index)
-- =============================================================================
SELECT DISTINCT a.BranchID, a.OrderNbr
INTO #Groups
FROM (
    SELECT d.BranchID, OrderNbr = CASE WHEN d.OrderType = 'IR' THEN d.OrderNbr ELSE CASE WHEN d.OrigOrderNbr = '' THEN d.OrderNbr ELSE d.OrigOrderNbr END END
    FROM dbo.OM_SalesOrd o WITH (NOLOCK)
    INNER JOIN dbo.OM_SalesOrdDet d WITH (NOLOCK) ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr
    LEFT JOIN ServerApplication_ExportExclude e WITH (NOLOCK) ON e.TableName = 'BLSellOrdALL1'
    WHERE ISNULL(e.CET, 0) < o.tstamp
    UNION ALL
    SELECT d.BranchID, d.OrderNbr
    FROM dbo.OM_PDASalesOrd o WITH (NOLOCK)
    INNER JOIN dbo.OM_PDASalesOrdDet d WITH (NOLOCK) ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr
    LEFT JOIN ServerApplication_ExportExclude e WITH (NOLOCK) ON e.TableName = 'BLSellOrdALL'
    WHERE ISNULL(e.CET, 0) < o.tstamp
    UNION ALL
    SELECT d.BranchID, OrderNbr = CASE WHEN d.OrderType = 'IR' THEN d.OrderNbr ELSE CASE WHEN d.OrigOrderNbr = '' THEN d.OrderNbr ELSE d.OrigOrderNbr END END
    FROM dbo.OM_SalesOrd o WITH (NOLOCK)
    INNER JOIN dbo.OM_SalesOrdDet d WITH (NOLOCK) ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr
    LEFT JOIN ServerApplication_ExportExclude e WITH (NOLOCK) ON e.TableName = 'BLSellOrdDETALL1'
    WHERE ISNULL(e.CET, 0) < d.tstamp
    UNION ALL
    SELECT d.BranchID, d.OrderNbr
    FROM dbo.OM_PDASalesOrd o WITH (NOLOCK)
    INNER JOIN dbo.OM_PDASalesOrdDet d WITH (NOLOCK) ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr
    LEFT JOIN ServerApplication_ExportExclude e WITH (NOLOCK) ON e.TableName = 'BLSellOrdDETALL'
    WHERE ISNULL(e.CET, 0) < d.tstamp
) a;

CREATE CLUSTERED INDEX IX_Groups ON #Groups (BranchID, OrderNbr);

-- =============================================================================
-- Materialize unit conversion (used by all 3 UNION ALL branches of main query)
-- Also replaces dbo.fr_OM_GetCnvFact() scalar UDF which does the same lookup
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
-- Materialize hierarchy (used by all 3 UNION ALL branches)
-- =============================================================================
SELECT h.InvtID, h.NganhHangDesc, h.HangName, h.NhanHangName
INTO #Hierarchy
FROM dbo.vs_IN_Hierrachy h WITH (NOLOCK);

CREATE CLUSTERED INDEX IX_Hierarchy ON #Hierarchy (InvtID);

-- =============================================================================
-- Main query
-- Changes: pre-fetched label vars instead of fr_GetLang,
--          b.CnvFact instead of fr_OM_GetCnvFact (same value, avoids per-row UDF),
--          #UnitConv/#Hierarchy instead of inline subqueries,
--          SARGable date filters.
-- =============================================================================

-- Branch 1: BL_SalesOrderALL anti-join (rows NOT in #Groups)
SELECT  NgayDatHang = CONVERT(VARCHAR, NgayDonDatHang, 103),
        SoHDDatHang = SoHDDatHang,
        NgayGiao = CONVERT(VARCHAR, NgayGiao, 103),
        MaVung = MaVung,
        TenVung = TenVung,
        MaTinhNPP = MaTinhNPP,
        TinhNPP = TinhNPP,
        MaTinhKH = MaTinhKH,
        TenTinhKH = TenTinhKH,
        MaNPP = MaNPP,
        TenNPP = TenNPP,
        DiaChiNPP = DiaChiNPP,
        SlsPerID = MaNhanVien,
        SlsName = TenNhanVien,
        Position = ViTriNhanVien,
        SoHoaDon = SoHoaDon,
        CustID = MaKhachHang,
        CustName = TenKhachHang,
        CustAddr = DiaChiKH,
        Channel = MaKenhBH,
        ChannelName = KenhBanHang,
        ShopType = MaLoaiDiemBan,
        ShopTypeName = LoaiDiemBan,
        InvtID = MaSanPham,
        InvtName = TenSanPham,
        NganhHangDesc = b.NganhHang,
        PhanKhucName = b.PhanKhuc,
        NhomHangName = b.NhanHang,
        OrderType = LoaiDonHang,
        LoaiHang = LoaiHang,
        DonViThung = DonViThung,
        DonViLe = DonViLe,
        QuyCach = QuyCach,
        SanluongThungDat = [SLThung(Dat)],
        SLLeDat = [SLLe(Dat)],
        SLThung = [SLThung(Giao)],
        SLLeGiao = [SLLe(Giao)],
        OrderAmt = [ThanhTien(Dat)],
        ShipAmt = [ThanhTien(Giao)],
        DiscAmtOrd = [GiamTien(Dat)],
        DiscAmtShip = [GiamTien(Giao)],
        DTD = [DoanhThu(Dat)],
        DTTG = [DoanhThu(Giao)],
        Status = TrangThai,
        [NoteNV] = '',
        [NoteDH] = ''
FROM dbo.BL_SalesOrderALL b WITH (NOLOCK)
INNER JOIN #Hierarchy hi ON hi.InvtID = b.MaSanPham
LEFT JOIN #Groups g WITH (NOLOCK) ON g.BranchID = b.MaNPP AND g.OrderNbr = b.SoHDDatHang
WHERE NgayDonDatHang BETWEEN @Fromdate AND @Todate
  AND g.OrderNbr IS NULL

UNION ALL

-- Branch 2: OM_PDASalesOrd (PDA orders)
SELECT
        NgayDatHang = CONVERT(VARCHAR, op.OrderDate, 103),
        SoHDDatHang = op.OrderNbr,
        NgayGiao = CASE WHEN o.shipdate = '1900-01-01 00:00:00' THEN '' ELSE CONVERT(VARCHAR, o.shipdate, 103) END,
        MaVung = vs.Territory,
        TenVung = st.Descr,
        MaTinhNPP = vs.State,
        TinhNPP = t.Descr,
        MaTinhKH = c.State,
        TenTinhKH = tt.Descr,
        MaNPP = op.BranchID,
        TenNPP = vs.CpnyName,
        DiaChiNPP = vs.Address,
        SlsPerID = op.SlsPerID,
        SlsName = s.Name,
        Position = CASE WHEN s.Position = 'S' THEN @lbl_RPSalesPerson
                        WHEN s.Position = 'SS' THEN @lbl_RPSalesSup
                        WHEN s.Position = 'ASM' THEN @lbl_RPAreaSalesMan
                        WHEN s.Position = 'RSM' THEN @lbl_RPRegionalDir
                        WHEN s.Position = 'FFD' THEN @lbl_ZSM
                        ELSE '' END,
        SoHoaDon = CASE WHEN op.Status = 'E' AND d.InvtID IS NULL THEN '' ELSE ISNULL(o.OrderNbr, '') END,
        CustID = op.CustID,
        CustName = ISNULL(c.CustName, cs.OutletName),
        CustAddr = CASE WHEN ISNULL(c.Addr1, '') <> '' THEN CONCAT(c.Addr1, ' ', c.Addr2, ' ', w1.name, ' ', w2.name, ' ', tt.Descr) ELSE CONCAT(cs.Addr1, ' ', cs.Addr2, ' ', w11.name, ' ', w22.name, ' ', ttt.Descr) END,
        Channel = ISNULL(c.Channel, cs.Channel),
        ChannelName = ISNULL(cn.Descr, cnn.Descr),
        ShopType = ISNULL(c.ShopType, cs.ShopType),
        ShopTypeName = ISNULL(sh.Descr, shh.Descr),
        InvtID = pd.InvtID,
        InvtName = ii.Descr,
        NganhHangDesc = hi.NganhHangDesc,
        PhanKhucName = hi.HangName,
        NhomHangName = hi.NhanHangName,
        OrderType = CASE WHEN ot.INDocType = 'IN' THEN @lbl_SaleOrder ELSE @lbl_AppforPaym END,
        LoaiHang = CASE WHEN pd.FreeItem = 0 THEN @lbl_SaleItem
                        WHEN pd.FreeItem = 1 AND pd.DisplayID = '' THEN @lbl_RPFreeItem
                        WHEN pd.FreeItem = 1 AND pd.DisplayID <> '' THEN @lbl_RetOnDisplay
                        ELSE '' END,
        DonViThung = b.FromUnit,
        DonViLe = b.ToUnit,
        QuyCach = b.CnvFact,
        SanluongThungDat = ISNULL((pd.LineQty * pd.UnitRate), 0) / (dbo.fr_OM_GetCnvFact(pd.InvtID)),
        SLLeDat = ISNULL(pd.LineQty * pd.UnitRate, 0),
        SLThung = CASE WHEN op.Status = 'C' THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * (ISNULL(d.LineQty * d.UnitRate, 0)) / (dbo.fr_OM_GetCnvFact(d.InvtID)) ELSE (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * (ISNULL(ISNULL(pd.QtyShip, 0) * pd.UnitRate, 0)) / (dbo.fr_OM_GetCnvFact(pd.InvtID)) END,
        SLLeGiao = CASE WHEN op.Status = 'C' THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(d.LineQty * d.UnitRate, 0) ELSE (ISNULL(ISNULL(pd.QtyShip, 0) * pd.UnitRate, 0)) END,
        OrderAmt = CASE WHEN pd.FreeItem = 0 THEN ISNULL(pd.LineQty * pd.SlsPrice, 0) - ISNULL(pd.DiscAmt, 0) ELSE 0 END,
        ShipAmt = CASE WHEN op.Status = 'C' THEN (CASE WHEN d.FreeItem = 0 THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(d.LineQty * d.SlsPrice, 0) - (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(d.DiscAmt, 0) ELSE 0 END) ELSE (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(pd.QtyShip * pd.SlsPrice, 0) END,
        DiscAmtOrd = ISNULL(pd.DiscAmt, 0),
        DiscAmtShip = CASE WHEN op.Status = 'C' THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(d.DiscAmt, 0) ELSE 0 END,
        DTD = CASE WHEN op.Status = 'C' THEN CASE WHEN pd.FreeItem = 0 THEN ISNULL(pd.LineQty * pd.SlsPrice, 0) ELSE 0 END ELSE ISNULL(pd.LineQty * pd.SlsPrice, 0) END,
        DTTG = CASE WHEN op.Status = 'C' THEN (CASE WHEN d.FreeItem = 0 THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(d.LineQty * d.SlsPrice, 0) ELSE 0 END) ELSE (CASE WHEN d.FreeItem = 0 THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(pd.QtyShip * pd.SlsPrice, 0) ELSE 0 END) END,
        Status = CASE WHEN op.Status = 'O' THEN N'Mở'
                      WHEN op.Status = 'C' THEN N'Đã giao hàng'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = '' THEN N'Đã gửi NPP'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = 'M' THEN N'Đã xác nhận'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = 'Q' THEN N'Giao hàng không thành công'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = 'S' THEN N'Đã xem'
                      WHEN op.Status IN ('E','V') THEN N'Đã Hủy'
                      WHEN op.Status = 'H' THEN @lbl_Hold
                      WHEN op.Status IN ('E','V') THEN @lbl_CloseOrder
                      WHEN o.Status IS NULL AND op.Status = 'O' THEN N'Mở'
                      WHEN o.Status IS NULL AND op.Status = 'H' THEN N'Chờ Xử Lý'
                      WHEN o.Status IS NULL AND op.Status = 'E' THEN N'Đóng Đơn Hàng'
                      WHEN o.Status IS NULL AND op.Status = 'C' THEN N'Xử Lý Hoàn Tất'
                      ELSE '' END,
        [NoteNV] = op.Remark,
        [NoteDH] = op.RemarkOrder
FROM dbo.OM_PDASalesOrd op WITH (NOLOCK)
INNER JOIN dbo.OM_PDASalesOrdDet pd WITH (NOLOCK) ON pd.BranchID = op.BranchID AND pd.OrderNbr = op.OrderNbr AND pd.posm = ''
INNER JOIN dbo.OM_OrderType ot WITH (NOLOCK) ON ot.OrderType = op.OrderType
INNER JOIN #Groups g ON g.BranchID = op.BranchID AND g.OrderNbr = op.OrderNbr
LEFT JOIN dbo.OM_SalesOrd o WITH (NOLOCK) ON op.BranchID = o.BranchID AND o.OrigOrderNbr = op.OrderNbr
LEFT JOIN dbo.OM_SalesOrdDet d WITH (NOLOCK) ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr AND pd.LineRef = d.LineRef
LEFT JOIN dbo.AR_Customer c WITH (NOLOCK) ON c.BranchID = op.BranchID AND c.CustId = op.CustID
LEFT JOIN dbo.AR_NewCustomerInfor cs WITH (NOLOCK) ON cs.BranchID = op.BranchID AND cs.CustId = op.CustID
LEFT JOIN dbo.vs_Company vs WITH (NOLOCK) ON op.BranchID = vs.CpnyID
LEFT JOIN dbo.SI_Territory st WITH (NOLOCK) ON vs.Territory = st.Territory
LEFT JOIN dbo.SI_SubTerritory sst WITH (NOLOCK) ON sst.Territory = st.Territory AND vs.Owner = sst.Code OR sst.Territory = 'ALL'
LEFT JOIN dbo.SI_State t WITH (NOLOCK) ON vs.State = t.State
LEFT JOIN dbo.SI_State tt WITH (NOLOCK) ON c.State = tt.State
INNER JOIN dbo.AR_Salesperson s WITH (NOLOCK) ON s.BranchID = op.BranchID AND s.SlsperId = op.SlsPerID
LEFT JOIN dbo.AR_Channel cn WITH (NOLOCK) ON c.Channel = cn.Code
LEFT JOIN dbo.AR_ShopType sh WITH (NOLOCK) ON sh.Channel = cn.Code AND sh.Code = c.ShopType
LEFT JOIN [SI_Ward] w1 WITH (NOLOCK) ON c.State = w1.State AND c.District = w1.District AND c.ward = w1.ward
LEFT JOIN SI_District w2 WITH (NOLOCK) ON c.State = w2.State AND c.District = w2.District
LEFT JOIN dbo.AR_Channel cnn WITH (NOLOCK) ON cs.Channel = cnn.Code
LEFT JOIN dbo.AR_ShopType shh WITH (NOLOCK) ON shh.Channel = cnn.Code AND shh.Code = cs.ShopType
LEFT JOIN [SI_Ward] w11 WITH (NOLOCK) ON cs.State = w11.State AND cs.District = w11.District AND cs.ward = w11.ward
LEFT JOIN SI_District w22 WITH (NOLOCK) ON cs.State = w22.State AND cs.District = w22.District
LEFT JOIN dbo.SI_State ttt WITH (NOLOCK) ON cs.State = tt.State
LEFT JOIN dbo.IN_Inventory ii WITH (NOLOCK) ON ii.InvtID = pd.InvtID
INNER JOIN #UnitConv b ON b.InvtID = ii.InvtID
INNER JOIN #Hierarchy hi ON hi.InvtID = pd.InvtID
WHERE op.OrderDate >= @FromDt AND op.OrderDate < @ToDtNext

UNION ALL

-- Branch 3: OM_SalesOrd with INDocType='CM' (credit memos / returns)
SELECT
        NgayDatHang = CONVERT(VARCHAR, op.OrderDate, 103),
        SoHDDatHang = op.OrigOrderNbr,
        NgayGiao = CASE WHEN op.shipdate = '1900-01-01 00:00:00' THEN '' ELSE CONVERT(VARCHAR, op.shipdate, 103) END,
        MaVung = vs.Territory,
        TenVung = st.Descr,
        MaTinhNPP = vs.State,
        TinhNPP = t.Descr,
        MaTinhKH = c.State,
        TenTinhKH = tt.Descr,
        MaNPP = op.BranchID,
        TenNPP = vs.CpnyName,
        DiaChiNPP = vs.Address,
        SlsPerID = op.SlsPerID,
        SlsName = s.Name,
        Position = CASE WHEN s.Position = 'S' THEN @lbl_RPSalesPerson
                        WHEN s.Position = 'SS' THEN @lbl_RPSalesSup
                        WHEN s.Position = 'ASM' THEN @lbl_RPAreaSalesMan
                        WHEN s.Position = 'RSM' THEN @lbl_RPRegionalDir
                        WHEN s.Position = 'FFD' THEN @lbl_ZSM
                        ELSE '' END,
        SoHoaDon = ISNULL(op.OrderNbr, ''),
        CustID = op.CustID,
        CustName = c.CustName,
        CustAddr = CONCAT(c.Addr1, ' ', c.Addr2, ' ', w1.name, ' ', w2.name, ' ', tt.Descr),
        Channel = c.Channel,
        ChannelName = cn.Descr,
        ShopType = c.ShopType,
        ShopTypeName = sh.Descr,
        InvtID = pd.InvtID,
        InvtName = ii.Descr,
        NganhHangDesc = hi.NganhHangDesc,
        PhanKhucName = hi.HangName,
        NhomHangName = hi.NhanHangName,
        OrderType = CASE WHEN ot.INDocType = 'IN' THEN @lbl_SaleOrder ELSE @lbl_AppforPaym END,
        LoaiHang = CASE WHEN pd.FreeItem = 0 THEN @lbl_SaleItem
                        WHEN pd.FreeItem = 1 AND pd.DisplayID = '' THEN @lbl_RPFreeItem
                        WHEN pd.FreeItem = 1 AND pd.DisplayID <> '' THEN @lbl_RetOnDisplay
                        ELSE '' END,
        DonViThung = b.FromUnit,
        DonViLe = b.ToUnit,
        QuyCach = b.CnvFact,
        SanluongThungDat = ISNULL((pd.LineQty * pd.UnitRate), 0) / (dbo.fr_OM_GetCnvFact(pd.InvtID)),
        SLLeDat = ISNULL(pd.LineQty * pd.UnitRate, 0),
        SLThung = 0,
        SLLeGiao = 0,
        OrderAmt = CASE WHEN pd.FreeItem = 0 THEN ISNULL(-1 * (pd.LineQty * pd.SlsPrice) + op.LineDiscAmt, 0) ELSE '0' END,
        ShipAmt = CASE WHEN op.Status = 'C' THEN (CASE WHEN pd.FreeItem = 0 AND op.OrderType IN ('IR','FR') THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(pd.LineQty * pd.SlsPrice, 0) + op.LineDiscAmt ELSE '0' END) ELSE 0 END,
        DiscAmtOrd = CASE WHEN op.OrderType IN ('IR','FR') AND pd.FreeItem = '0' THEN ISNULL(-1 * op.LineDiscAmt, 0) ELSE '0' END,
        DiscAmtShip = CASE WHEN op.Status = 'C' THEN (CASE WHEN op.ordertype IN ('IR','FR') THEN -1 ELSE 1 END) * ISNULL(pd.DiscAmt, 0) ELSE 0 END,
        DTD = CASE WHEN op.Status = 'C' THEN CASE WHEN pd.FreeItem = 0 THEN ISNULL(-1 * pd.LineQty * pd.SlsPrice, 0) ELSE 0 END ELSE 0 END,
        DTTG = CASE WHEN op.Status = 'C' THEN (CASE WHEN pd.FreeItem = 0 AND op.ordertype IN ('IR','FR') THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(pd.LineQty * pd.SlsPrice, 0) ELSE 0 END) ELSE 0 END,
        Status = CASE WHEN op.Status = 'O' THEN N'Đặt Hàng'
                      WHEN op.Status = 'C' THEN N'Đã giao hàng'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = '' THEN N'Đã gửi NPP'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = 'M' THEN N'Đã xác nhận'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = 'Q' THEN N'Giao hàng không thành công'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = 'S' THEN N'Đã xem'
                      WHEN op.Status IN ('E','V') THEN N'Đã Hủy'
                      WHEN op.Status IN ('H','N') THEN N'Chờ Xử Lý'
                      WHEN op.Status IN ('E','V') THEN @lbl_CloseOrder
                      WHEN op.Status = 'I' THEN N'Đã Xác Nhận'
                      WHEN op.Status = 'P' THEN N'Đang Xử Lý'
                      WHEN op.Status = 'T' THEN N'Phân Bổ Giao Hàng'
                      ELSE '' END,
        [NoteNV] = op.Remark,
        [NoteDH] = op.RemarkOrder
FROM dbo.OM_SalesOrd op WITH (NOLOCK)
INNER JOIN dbo.OM_SalesOrdDet pd WITH (NOLOCK) ON pd.BranchID = op.BranchID AND pd.OrderNbr = op.OrderNbr
INNER JOIN dbo.OM_OrderType ot WITH (NOLOCK) ON ot.OrderType = op.OrderType
INNER JOIN #Groups g ON g.BranchID = op.BranchID AND g.OrderNbr = op.OrderNbr
LEFT JOIN dbo.AR_Customer c WITH (NOLOCK) ON c.BranchID = op.BranchID AND c.CustId = op.CustID
LEFT JOIN dbo.vs_Company vs WITH (NOLOCK) ON op.BranchID = vs.CpnyID
LEFT JOIN dbo.SI_Territory st WITH (NOLOCK) ON vs.Territory = st.Territory
LEFT JOIN dbo.SI_SubTerritory sst WITH (NOLOCK) ON sst.Territory = st.Territory AND vs.Owner = sst.Code OR sst.Territory = 'ALL'
LEFT JOIN dbo.SI_State t WITH (NOLOCK) ON vs.State = t.State
LEFT JOIN dbo.SI_State tt WITH (NOLOCK) ON c.State = tt.State
INNER JOIN dbo.AR_Salesperson s WITH (NOLOCK) ON s.BranchID = op.BranchID AND s.SlsperId = op.SlsPerID
LEFT JOIN dbo.AR_Channel cn WITH (NOLOCK) ON c.Channel = cn.Code
LEFT JOIN dbo.AR_ShopType sh WITH (NOLOCK) ON sh.Channel = cn.Code AND sh.Code = c.ShopType
LEFT JOIN [SI_Ward] w1 WITH (NOLOCK) ON c.State = w1.State AND c.District = w1.District AND c.ward = w1.ward
LEFT JOIN SI_District w2 WITH (NOLOCK) ON c.State = w2.State AND c.District = w2.District
LEFT JOIN dbo.IN_Inventory ii WITH (NOLOCK) ON ii.InvtID = pd.InvtID
INNER JOIN #UnitConv b ON b.InvtID = ii.InvtID
INNER JOIN #Hierarchy hi ON hi.InvtID = pd.InvtID
WHERE ot.INDocType = 'CM'
  AND op.OrderDate >= @FromDt AND op.OrderDate < @ToDtNext

UNION ALL

-- Branch 4: OM_SalesOrd with Crtd_Prog='OM10100' AND INDocType<>'CM'
SELECT
        NgayDatHang = CONVERT(VARCHAR, op.OrderDate, 103),
        SoHDDatHang = '',
        NgayGiao = CASE WHEN op.shipdate = '1900-01-01 00:00:00' THEN '' ELSE CONVERT(VARCHAR, op.shipdate, 103) END,
        MaVung = vs.Territory,
        TenVung = st.Descr,
        MaTinhNPP = vs.State,
        TinhNPP = t.Descr,
        MaTinhKH = c.State,
        TenTinhKH = tt.Descr,
        MaNPP = op.BranchID,
        TenNPP = vs.CpnyName,
        DiaChiNPP = vs.Address,
        SlsPerID = op.SlsPerID,
        SlsName = s.Name,
        Position = CASE WHEN s.Position = 'S' THEN @lbl_RPSalesPerson
                        WHEN s.Position = 'SS' THEN @lbl_RPSalesSup
                        WHEN s.Position = 'ASM' THEN @lbl_RPAreaSalesMan
                        WHEN s.Position = 'RSM' THEN @lbl_RPRegionalDir
                        WHEN s.Position = 'FFD' THEN @lbl_ZSM
                        ELSE '' END,
        SoHoaDon = ISNULL(op.OrderNbr, ''),
        CustID = op.CustID,
        CustName = c.CustName,
        CustAddr = CONCAT(c.Addr1, ' ', c.Addr2, ' ', w1.name, ' ', w2.name, ' ', tt.Descr),
        Channel = c.Channel,
        ChannelName = cn.Descr,
        ShopType = c.ShopType,
        ShopTypeName = sh.Descr,
        InvtID = pd.InvtID,
        InvtName = ii.Descr,
        NganhHangDesc = hi.NganhHangDesc,
        PhanKhucName = hi.HangName,
        NhomHangName = hi.NhanHangName,
        OrderType = CASE WHEN ot.INDocType = 'IN' THEN @lbl_SaleOrder ELSE @lbl_AppforPaym END,
        LoaiHang = CASE WHEN pd.FreeItem = 0 THEN @lbl_SaleItem
                        WHEN pd.FreeItem = 1 AND pd.DisplayID = '' THEN @lbl_RPFreeItem
                        WHEN pd.FreeItem = 1 AND pd.DisplayID <> '' THEN @lbl_RetOnDisplay
                        ELSE '' END,
        DonViThung = b.FromUnit,
        DonViLe = b.ToUnit,
        QuyCach = b.CnvFact,
        SanluongThungDat = ISNULL((pd.LineQty * pd.UnitRate), 0) / (dbo.fr_OM_GetCnvFact(pd.InvtID)),
        SLLeDat = ISNULL(pd.LineQty * pd.UnitRate, 0),
        SLThung = CASE WHEN op.Status = 'C' THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * (ISNULL(pd.LineQty * pd.UnitRate, 0)) / (dbo.fr_OM_GetCnvFact(pd.InvtID)) ELSE 0 END,
        SLLeGiao = CASE WHEN op.Status = 'C' THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(pd.LineQty * pd.UnitRate, 0) ELSE 0 END,
        OrderAmt = CASE WHEN pd.FreeItem = 0 THEN ISNULL(pd.LineQty * pd.SlsPrice, 0) - ISNULL(pd.DiscAmt, 0) ELSE 0 END,
        ShipAmt = CASE WHEN op.Status = 'C' THEN (CASE WHEN pd.FreeItem = 0 THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(pd.LineQty * pd.SlsPrice, 0) - (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(pd.DiscAmt, 0) ELSE 0 END) ELSE 0 END,
        DiscAmtOrd = ISNULL(pd.DiscAmt, 0),
        DiscAmtShip = CASE WHEN op.Status = 'C' THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(pd.DiscAmt, 0) ELSE 0 END,
        DTD = CASE WHEN op.Status = 'C' THEN CASE WHEN pd.FreeItem = 0 THEN ISNULL(pd.LineQty * pd.SlsPrice, 0) ELSE 0 END ELSE 0 END,
        DTTG = CASE WHEN op.Status = 'C' THEN (CASE WHEN pd.FreeItem = 0 THEN (CASE WHEN ot.INDocType = 'IN' THEN 1 ELSE -1 END) * ISNULL(pd.LineQty * pd.SlsPrice, 0) ELSE 0 END) ELSE 0 END,
        Status = CASE WHEN op.Status = 'O' THEN N'Đặt Hàng'
                      WHEN op.Status = 'C' THEN N'Đã giao hàng'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = '' THEN N'Đã gửi NPP'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = 'M' THEN N'Đã xác nhận'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = 'Q' THEN N'Giao hàng không thành công'
                      WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus, '') = 'S' THEN N'Đã xem'
                      WHEN op.Status IN ('E','V') THEN N'Đã Hủy'
                      WHEN op.Status IN ('H','N') THEN N'Chờ Xử Lý'
                      WHEN op.Status IN ('E','V') THEN @lbl_CloseOrder
                      WHEN op.Status = 'I' THEN N'Đã Xác Nhận'
                      WHEN op.Status = 'P' THEN N'Đang Xử Lý'
                      WHEN op.Status = 'T' THEN N'Phân Bổ Giao Hàng'
                      ELSE '' END,
        [NoteNV] = op.Remark,
        [NoteDH] = op.RemarkOrder
FROM dbo.OM_SalesOrd op WITH (NOLOCK)
INNER JOIN dbo.OM_SalesOrdDet pd WITH (NOLOCK) ON pd.BranchID = op.BranchID AND pd.OrderNbr = op.OrderNbr AND pd.posm = ''
INNER JOIN dbo.OM_OrderType ot WITH (NOLOCK) ON ot.OrderType = op.OrderType
INNER JOIN #Groups g ON g.BranchID = op.BranchID AND g.OrderNbr = op.OrderNbr
LEFT JOIN dbo.AR_Customer c WITH (NOLOCK) ON c.BranchID = op.BranchID AND c.CustId = op.CustID
LEFT JOIN dbo.vs_Company vs WITH (NOLOCK) ON op.BranchID = vs.CpnyID
LEFT JOIN dbo.SI_Territory st WITH (NOLOCK) ON vs.Territory = st.Territory
LEFT JOIN dbo.SI_SubTerritory sst WITH (NOLOCK) ON sst.Territory = st.Territory AND vs.Owner = sst.Code OR sst.Territory = 'ALL'
LEFT JOIN dbo.SI_State t WITH (NOLOCK) ON vs.State = t.State
LEFT JOIN dbo.SI_State tt WITH (NOLOCK) ON c.State = tt.State
INNER JOIN dbo.AR_Salesperson s WITH (NOLOCK) ON s.BranchID = op.BranchID AND s.SlsperId = op.SlsPerID
LEFT JOIN dbo.AR_Channel cn WITH (NOLOCK) ON c.Channel = cn.Code
LEFT JOIN dbo.AR_ShopType sh WITH (NOLOCK) ON sh.Channel = cn.Code AND sh.Code = c.ShopType
LEFT JOIN [SI_Ward] w1 WITH (NOLOCK) ON c.State = w1.State AND c.District = w1.District AND c.ward = w1.ward
LEFT JOIN SI_District w2 WITH (NOLOCK) ON c.State = w2.State AND c.District = w2.District
LEFT JOIN dbo.IN_Inventory ii WITH (NOLOCK) ON ii.InvtID = pd.InvtID
INNER JOIN #UnitConv b ON b.InvtID = ii.InvtID
INNER JOIN #Hierarchy hi ON hi.InvtID = pd.InvtID
WHERE op.OrderDate >= @FromDt AND op.OrderDate < @ToDtNext
  AND OP.Crtd_Prog = 'OM10100'
  AND ot.INDocType <> 'CM';

DROP TABLE #Groups;
DROP TABLE #UnitConv;
DROP TABLE #Hierarchy;
