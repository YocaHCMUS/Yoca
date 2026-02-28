DECLARE @Fromdate SMALLDATETIME ='2026-1-01' 
DECLARE @Todate SMALLDATETIME ='2026-12-31' 
DECLARE @LangID SMALLINT = 1
	SELECT DISTINCT a.BranchID, a.OrderNbr
	INTO #Groups
	FROM(

	SELECT d.BranchID, OrderNbr=CASE WHEN d.OrderType ='IR' THEN d.OrderNbr ELSE CASE WHEN d.OrigOrderNbr='' THEN d.OrderNbr ELSE  d.OrigOrderNbr  END END
	FROM dbo.OM_SalesOrd o WITH(NOLOCK)
	INNER JOIN dbo.OM_SalesOrdDet d WITH(NOLOCK) ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr
	LEFT JOIN ServerApplication_ExportExclude   e WITH(NOLOCK) ON e.TableName = 'BLSellOrdALL1'
	WHERE ISNULL(e.CET,0) < o.tstamp
	UNION ALL
	SELECT d.BranchID, d.OrderNbr
	FROM dbo.OM_PDASalesOrd o WITH(NOLOCK)
	INNER JOIN dbo.OM_PDASalesOrdDet d WITH(NOLOCK) ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr
	LEFT JOIN ServerApplication_ExportExclude   e WITH(NOLOCK) ON e.TableName = 'BLSellOrdALL'
	WHERE ISNULL(e.CET,0) < o.tstamp 
	UNION ALL
	SELECT d.BranchID, OrderNbr= CASE WHEN d.OrderType ='IR' THEN d.OrderNbr ELSE CASE WHEN d.OrigOrderNbr='' THEN d.OrderNbr ELSE  d.OrigOrderNbr  END END
	FROM dbo.OM_SalesOrd o WITH(NOLOCK)
	INNER JOIN dbo.OM_SalesOrdDet d WITH(NOLOCK) ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr
	LEFT JOIN ServerApplication_ExportExclude   e WITH(NOLOCK) ON e.TableName = 'BLSellOrdDETALL1'
	WHERE ISNULL(e.CET,0) < d.tstamp 
	UNION ALL
	SELECT d.BranchID, d.OrderNbr
	FROM dbo.OM_PDASalesOrd o WITH(NOLOCK)
	INNER JOIN dbo.OM_PDASalesOrdDet d WITH(NOLOCK) ON d.BranchID = o.BranchID AND d.OrderNbr = o.OrderNbr
	LEFT JOIN ServerApplication_ExportExclude   e WITH(NOLOCK) ON e.TableName = 'BLSellOrdDETALL'
	WHERE ISNULL(e.CET,0) < d.tstamp 
      ) a

SELECT  NgayDatHang = CONVERT(VARCHAR, NgayDonDatHang, 103) ,
			SoHDDatHang = SoHDDatHang ,  
			NgayGiao = CONVERT(VARCHAR, NgayGiao, 103) ,
            MaVung = MaVung ,
            TenVung = TenVung ,
            MaTinhNPP = MaTinhNPP ,
            TinhNPP = TinhNPP ,
            MaTinhKH = MaTinhKH ,
            TenTinhKH = TenTinhKH ,
            MaNPP = MaNPP,
            TenNPP = TenNPP ,
            DiaChiNPP = DiaChiNPP ,
            SlsPerID = MaNhanVien ,
            SlsName = TenNhanVien ,
			Position= ViTriNhanVien,
			SoHoaDon = SoHoaDon ,   
            CustID = MaKhachHang ,
            CustName = TenKhachHang ,
            CustAddr = DiaChiKH ,
            Channel = MaKenhBH ,
            ChannelName = KenhBanHang,
            ShopType = MaLoaiDiemBan,
            ShopTypeName = LoaiDiemBan ,
            InvtID = MaSanPham ,
            InvtName = TenSanPham ,
            NganhHangDesc =b.NganhHang ,
            PhanKhucName = b.PhanKhuc,
            NhomHangName =  b.NhanHang,
			OrderType = LoaiDonHang,
            LoaiHang =LoaiHang,
            DonViThung = DonViThung ,
            DonViLe = DonViLe ,
            QuyCach = QuyCach,
            SanluongThungDat =  [SLThung(Dat)],
            SLLeDat = [SLLe(Dat)] ,
			SLThung =  [SLThung(Giao)],
            SLLeGiao =[SLLe(Giao)] ,
            OrderAmt = [ThanhTien(Dat)],
			ShipAmt = [ThanhTien(Giao)],
			DiscAmtOrd = [GiamTien(Dat)],
			DiscAmtShip = [GiamTien(Giao)],
            DTD = [DoanhThu(Dat)],
			DTTG = [DoanhThu(Giao)],
			Status= TrangThai,
			 [NoteNV]=''
			,[NoteDH] =''
			FROM   dbo.BL_SalesOrderALL b WITH(NOLOCK)
			INNER JOIN dbo.vs_IN_Hierrachy hi ON hi.InvtID = b.MaSanPham
			LEFT JOIN #Groups g WITH(NOLOCK) ON g.BranchID=b.MaNPP AND g.OrderNbr=b.SoHDDatHang
			WHERE 
			NgayDonDatHang BETWEEN @Fromdate AND @Todate
			AND 
			g.OrderNbr IS NULL
			UNION ALL
			SELECT  
			NgayDatHang = CONVERT(VARCHAR, op.OrderDate, 103) ,
			SoHDDatHang = op.OrderNbr ,  
			NgayGiao =CASE WHEN o.shipdate='1900-01-01 00:00:00' THEN '' ELSE CONVERT(VARCHAR, o.shipdate, 103) END  ,
            MaVung = vs.Territory ,
            TenVung = st.Descr ,
            MaTinhNPP = vs.State ,
            TinhNPP = t.Descr ,
            MaTinhKH = c.State ,
            TenTinhKH = tt.Descr ,
            MaNPP = op.BranchID,
            TenNPP = vs.CpnyName ,
            DiaChiNPP = vs.Address ,
            SlsPerID = op.SlsPerID ,
            SlsName = s.Name ,
			Position= CASE WHEN s.Position  = 'S' THEN dbo.fr_GetLang(@LangID,'RPSalesPerson') 
												WHEN s.Position  = 'SS' THEN dbo.fr_GetLang(@LangID,'RPSalesSup') 
												WHEN s.Position  = 'ASM' THEN dbo.fr_GetLang(@LangID,'RPAreaSalesMan') 
												WHEN s.Position  = 'RSM' THEN dbo.fr_GetLang(@LangID,'RPRegionalDir') 
												WHEN s.Position  = 'FFD' THEN dbo.fr_GetLang(@LangID,'ZSM') 
												ELSE ''
												END,
			SoHoaDon = CASE WHEN op.Status='E' AND d.InvtID IS NULL THEN '' ELSE ISNULL(o.OrderNbr,'') END ,  
            CustID = op.CustID ,
            CustName = isnull(c.CustName,cs.OutletName) ,
            CustAddr = case when isnull(c.Addr1,'') <>'' then concat(c.Addr1,' ',c.Addr2,' ',w1.name,' ',w2.name,' ',tt.Descr) ELSE  concat(cs.Addr1,' ',cs.Addr2,' ',w11.name,' ',w22.name,' ',ttt.Descr)  END,
            Channel = isnull(c.Channel,cs.Channel) ,
            ChannelName = isnull(cn.Descr,cnn.Descr),
            ShopType = isnull(c.ShopType,cs.ShopType),
            ShopTypeName = isnull(sh.Descr,shh.Descr) ,
            InvtID = pd.InvtID ,
            InvtName = ii.Descr ,
            NganhHangDesc =hi.NganhHangDesc ,
            PhanKhucName = hi.HangName,
            NhomHangName =  hi.NhanHangName,
			OrderType = CASE WHEN ot.INDocType='IN' Then dbo.fr_GetLang(@LangID,'SaleOrder')  
							 ELSE dbo.fr_GetLang(@LangID,'AppforPaym')  
							 END,
            LoaiHang = CASE WHEN pd.FreeItem=0 THEN dbo.fr_GetLang(@LangID,'SaleItem')  
						   WHEN pd.FreeItem=1 AND pd.DisplayID = ''THEN dbo.fr_GetLang(@LangID,'RPFreeItem') 
						   WHEN pd.FreeItem=1 AND pd.DisplayID <> '' THEN dbo.fr_GetLang(@LangID,'RetOnDisplay') 
						   ELSE ''
						   END,
            DonViThung = b.FromUnit ,
            DonViLe = b.ToUnit ,
            QuyCach = b.CnvFact,
            SanluongThungDat =  ISNULL((pd.LineQty * pd.UnitRate ),0)
                        / ( dbo.fr_OM_GetCnvFact(pd.InvtID) ),
            SLLeDat = ISNULL(pd.LineQty * pd.UnitRate,0),
			SLThung = CASE WHEN op.Status='C' THEN  (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*(ISNULL(d.LineQty * d.UnitRate,0) ) / ( dbo.fr_OM_GetCnvFact(d.InvtID) ) ELSE (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*(ISNULL(isnull(pd.QtyShip,0) * pd.UnitRate,0) ) / ( dbo.fr_OM_GetCnvFact(pd.InvtID) ) END,
            SLLeGiao = CASE WHEN op.Status='C' THEN (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(d.LineQty * d.UnitRate,0)  ELSE (ISNULL(isnull(pd.QtyShip,0) * pd.UnitRate,0) ) END ,
            OrderAmt = CASE WHEN pd.FreeItem=0 THEN ISNULL(pd.LineQty*pd.SlsPrice,0) - ISNULL(pd.DiscAmt,0) ELSE 0 END,
			ShipAmt = CASE WHEN op.Status='C' THEN ( CASE WHEN d.FreeItem=0 THEN (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(d.LineQty*d.SlsPrice,0) - (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(d.DiscAmt,0) ELSE 0 END) ELSE (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(pd.QtyShip*pd.SlsPrice,0) END,
			DiscAmtOrd = ISNULL(pd.DiscAmt,0),
			DiscAmtShip = CASE WHEN op.Status='C' THEN  (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(d.DiscAmt,0) ELSE 0 END,
            DTD = CASE WHEN op.Status='C' THEN  CASE WHEN pd.FreeItem=0 THEN ISNULL(pd.LineQty*pd.SlsPrice,0) ELSE 0 END ELSE ISNULL(pd.LineQty*pd.SlsPrice,0) END,
			DTTG =  CASE WHEN op.Status='C' THEN (CASE WHEN d.FreeItem=0 THEN (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(d.LineQty*d.SlsPrice,0) ELSE 0 END) ELSE (CASE WHEN d.FreeItem=0 THEN (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(pd.QtyShip*pd.SlsPrice,0) ELSE 0 END) END,
			Status=  CASE WHEN  op.Status =  'O' THEN N'Mở'
							WHEN op.Status =  'C' THEN N'Đã giao hàng'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='' THEN N'Đã gửi NPP'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='M' THEN N'Đã xác nhận'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='Q' THEN N'Giao hàng không thành công'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='S' THEN N'Đã xem'
							WHEN op.Status  IN(  'E','V') THEN N'Đã Hủy'
							WHEN op.Status='H' THEN dbo.fr_GetLang(@LangID,'Hold') 
							WHEN  op.Status  IN(  'E','V') THEN dbo.fr_GetLang(@LangID,'CloseOrder')
							WHEN o.Status IS NULL AND op.Status='O' THEN  N'Mở'
							WHEN o.Status IS NULL AND op.Status='H' THEN  N'Chờ Xử Lý'
							WHEN o.Status IS NULL AND op.Status='E' THEN  N'Đóng Đơn Hàng'
							WHEN o.Status IS NULL AND op.Status='C' THEN  N'Xử Lý Hoàn Tất'
							ELSE ''
								END 
			 ,[NoteNV]=op.Remark
			,[NoteDH] =op.RemarkOrder

    FROM     dbo.OM_PDASalesOrd op WITH(NOLOCK) 
						INNER JOIN dbo.OM_PDASalesOrdDet pd WITH(NOLOCK) ON pd.BranchID = op.BranchID AND pd.OrderNbr = op.OrderNbr  and pd.posm =''
						INNER JOIN dbo.OM_OrderType ot WITH(NOLOCK) ON ot.OrderType = op.OrderType
						INNER JOIN #Groups g WITH(NOLOCK) ON g.BranchID=op.BranchID AND g.OrderNbr=op.OrderNbr	
						LEFT JOIN dbo.OM_SalesOrd  o WITH(NOLOCK) ON op.BranchID = o.BranchID AND o.OrigOrderNbr=op.OrderNbr
                        LEFT JOIN dbo.OM_SalesOrdDet d WITH(NOLOCK) ON d.BranchID = o.BranchID
                                                              AND d.OrderNbr = o.OrderNbr AND pd.LineRef = d.LineRef 
						LEFT JOIN dbo.AR_Customer c WITH(NOLOCK) ON c.BranchID = op.BranchID
                                                              AND c.CustId = op.CustID

						LEFT JOIN dbo.AR_NewCustomerInfor cs WITH(NOLOCK) ON cs.BranchID = op.BranchID
                                                              AND cs.CustId = op.CustID
                        LEFT JOIN dbo.vs_Company vs WITH(NOLOCK) ON op.BranchID = vs.CpnyID
                        LEFT JOIN dbo.SI_Territory st WITH(NOLOCK) ON vs.Territory = st.Territory
						LEFT JOIN dbo.SI_SubTerritory sst WITH(NOLOCK) ON sst.Territory = st.Territory AND vs.Owner=sst.Code OR sst.Territory='ALL'
                        LEFT JOIN dbo.SI_State t WITH(NOLOCK) ON vs.State = t.State
                        LEFT JOIN dbo.SI_State tt WITH(NOLOCK) ON c.State = tt.State
                        INNER JOIN dbo.AR_Salesperson s WITH(NOLOCK) ON s.BranchID = op.BranchID
                        AND s.SlsperId = op.SlsPerID
                        LEFT JOIN dbo.AR_Channel cn WITH(NOLOCK) ON c.Channel = cn.Code
                        LEFT JOIN dbo.AR_ShopType sh WITH(NOLOCK) ON sh.Channel = cn.Code
                                                              AND sh.Code = c.ShopType
						left join 	[SI_Ward]	w1 with(nolock) on c.State=w1.State and c.District=w1.District and c.ward=w1.ward 
						left join 	SI_District	w2 with(nolock) on c.State=w2.State and c.District=w2.District --and c.Country=w2.Country	
						 LEFT JOIN dbo.AR_Channel cnn WITH(NOLOCK) ON cs.Channel = cnn.Code
                        LEFT JOIN dbo.AR_ShopType shh WITH(NOLOCK) ON shh.Channel = cnn.Code
                                                              AND shh.Code = cs.ShopType
						left join 	[SI_Ward]	w11 with(nolock) on cs.State=w11.State and cs.District=w11.District and cs.ward=w11.ward 
						left join 	SI_District	w22 with(nolock) on cs.State=w22.State and cs.District=w22.District-- and cs.Country=w22.Country	
						 LEFT JOIN dbo.SI_State ttt WITH(NOLOCK) ON cs.State = tt.State
                        LEFT JOIN dbo.IN_Inventory ii WITH(NOLOCK) ON ii.InvtID = pd.InvtID
                        INNER JOIN ( SELECT k.InvtID ,
                                            k.CnvFact ,
                                            u.FromUnit ,
                                            u.ToUnit
                                     FROM   ( SELECT DISTINCT
                                                        InvtID ,
                                                        CnvFact = MAX(CnvFact)
                                              FROM      dbo.IN_UnitConversion WITH(NOLOCK)
                                              WHERE     UnitType = 3
                                              GROUP BY  InvtID
                                            ) k
                                            INNER JOIN dbo.IN_UnitConversion u WITH(NOLOCK) ON u.InvtID = k.InvtID
                                                              AND u.CnvFact = k.CnvFact
                                   ) b ON b.InvtID = ii.InvtID
                        INNER JOIN dbo.vs_IN_Hierrachy hi ON hi.InvtID = pd.InvtID
            WHERE   cast( op.OrderDate  as date) BETWEEN cast(@Fromdate as date) AND cast(@Todate as date)
			UNION ALL
			SELECT 
			NgayDatHang = CONVERT(VARCHAR, op.OrderDate, 103) ,
			SoHDDatHang = op.OrigOrderNbr ,  
			NgayGiao =CASE WHEN op.shipdate='1900-01-01 00:00:00' THEN '' ELSE CONVERT(VARCHAR, op.shipdate, 103) END    ,
            MaVung = vs.Territory ,
            TenVung = st.Descr ,
            MaTinhNPP = vs.State ,
            TinhNPP = t.Descr ,
            MaTinhKH = c.State ,
            TenTinhKH = tt.Descr ,
            MaNPP = op.BranchID,
            TenNPP = vs.CpnyName ,
            DiaChiNPP = vs.Address ,
            SlsPerID = op.SlsPerID ,
            SlsName = s.Name ,
			Position= CASE WHEN s.Position  = 'S' THEN dbo.fr_GetLang(@LangID,'RPSalesPerson') 
												WHEN s.Position  = 'SS' THEN dbo.fr_GetLang(@LangID,'RPSalesSup') 
												WHEN s.Position  = 'ASM' THEN dbo.fr_GetLang(@LangID,'RPAreaSalesMan') 
												WHEN s.Position  = 'RSM' THEN dbo.fr_GetLang(@LangID,'RPRegionalDir') 
												WHEN s.Position  = 'FFD' THEN dbo.fr_GetLang(@LangID,'ZSM') 
												ELSE ''
												END,
			SoHoaDon = ISNULL(op.OrderNbr,'') ,    
            CustID = op.CustID ,
            CustName = c.CustName ,
            CustAddr = concat(c.Addr1,' ',c.Addr2,' ',w1.name,' ',w2.name,' ',tt.Descr) ,
            Channel = c.Channel ,
            ChannelName = cn.Descr,
            ShopType = c.ShopType,
            ShopTypeName = sh.Descr ,
            InvtID = pd.InvtID ,
            InvtName = ii.Descr ,
            NganhHangDesc =hi.NganhHangDesc ,
            PhanKhucName = hi.HangName,
            NhomHangName =  hi.NhanHangName,
			OrderType = CASE WHEN ot.INDocType='IN' Then dbo.fr_GetLang(@LangID,'SaleOrder')  
							 ELSE dbo.fr_GetLang(@LangID,'AppforPaym')  
							 END,
            LoaiHang = CASE WHEN pd.FreeItem=0 THEN dbo.fr_GetLang(@LangID,'SaleItem')
						   WHEN pd.FreeItem=1 AND pd.DisplayID = ''THEN dbo.fr_GetLang(@LangID,'RPFreeItem')  
						   WHEN pd.FreeItem=1 AND pd.DisplayID <> '' THEN dbo.fr_GetLang(@LangID,'RetOnDisplay') 
						   ELSE ''
						   END,
            DonViThung = b.FromUnit ,
            DonViLe = b.ToUnit ,
            QuyCach = b.CnvFact,
            SanluongThungDat =  ISNULL((pd.LineQty * pd.UnitRate ),0)
                        / ( dbo.fr_OM_GetCnvFact(pd.InvtID) ),
            SLLeDat = ISNULL(pd.LineQty * pd.UnitRate,0),
			SLThung =  0,
            SLLeGiao =0,
            OrderAmt = CASE 
							WHEN pd.FreeItem=0 THEN ISNULL(-1*(pd.LineQty*pd.SlsPrice)+op.LineDiscAmt,0)
							ELSE '0'
							END,
			ShipAmt =  CASE WHEN op.Status='C' THEN (CASE WHEN pd.FreeItem=0 and op.OrderType in ('IR','FR') THEN (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(pd.LineQty*pd.SlsPrice,0)+op.LineDiscAmt else '0'end )ELSE 0 END,
			DiscAmtOrd =case when op.OrderType in ('IR','FR') and pd.FreeItem='0' then ISNULL(-1*op.LineDiscAmt,0)
							else '0'
							end,
			DiscAmtShip =  CASE WHEN op.Status='C' THEN (CASE WHEN op.ordertype in ('IR','FR')  THEN -1 ELSE 1 END)*ISNULL(pd.DiscAmt,0) ELSE 0 END,
            DTD = CASE WHEN op.Status='C' THEN  CASE WHEN pd.FreeItem=0 THEN ISNULL(-1*pd.LineQty*pd.SlsPrice,0) ELSE 0 END ELSE 0 END,
			DTTG =  CASE WHEN op.Status='C' THEN  (CASE WHEN pd.FreeItem=0 and op.ordertype in ('IR','FR')THEN (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(pd.LineQty*pd.SlsPrice,0) ELSE 0 END) ELSE 0 END,
			Status=  CASE WHEN op.Status =  'O' THEN N'Đặt Hàng'
							WHEN op.Status =  'C' THEN N'Đã giao hàng'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='' THEN N'Đã gửi NPP'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='M' THEN N'Đã xác nhận'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='Q' THEN N'Giao hàng không thành công'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='S' THEN N'Đã xem'
							WHEN op.Status  IN(  'E','V') THEN N'Đã Hủy'
							WHEN op.Status  IN(  'H','N') THEN  N'Chờ Xử Lý'
							WHEN  op.Status  IN(  'E','V') THEN dbo.fr_GetLang(@LangID,'CloseOrder') 
							WHEN op.Status =  'I' THEN N'Đã Xác Nhận'
							WHEN op.Status =  'P' THEN N'Đang Xử Lý'
							WHEN op.Status =  'T' THEN N'Phân Bổ Giao Hàng'
							ELSE ''
								END,
			 [NoteNV]=  op.Remark
			,[NoteDH] =op.RemarkOrder
    FROM     dbo.OM_SalesOrd op WITH(NOLOCK) 
						INNER JOIN dbo.OM_SalesOrdDet pd WITH(NOLOCK) ON pd.BranchID = op.BranchID AND pd.OrderNbr = op.OrderNbr 
						INNER JOIN dbo.OM_OrderType ot WITH(NOLOCK) ON ot.OrderType = op.OrderType
						INNER JOIN #Groups g WITH(NOLOCK) ON g.BranchID=op.BranchID AND g.OrderNbr=op.OrderNbr
						LEFT JOIN dbo.AR_Customer c WITH(NOLOCK) ON c.BranchID = op.BranchID
                                                              AND c.CustId = op.CustID
                        LEFT JOIN dbo.vs_Company vs WITH(NOLOCK) ON op.BranchID = vs.CpnyID
                        LEFT JOIN dbo.SI_Territory st WITH(NOLOCK) ON vs.Territory = st.Territory
						LEFT JOIN dbo.SI_SubTerritory sst WITH(NOLOCK) ON sst.Territory = st.Territory AND vs.Owner=sst.Code OR sst.Territory='ALL'
                        LEFT JOIN dbo.SI_State t WITH(NOLOCK) ON vs.State = t.State
                        LEFT JOIN dbo.SI_State tt WITH(NOLOCK) ON c.State = tt.State
                        INNER JOIN dbo.AR_Salesperson s WITH(NOLOCK) ON s.BranchID = op.BranchID
                                                              AND s.SlsperId = op.SlsPerID
                        LEFT JOIN dbo.AR_Channel cn WITH(NOLOCK) ON c.Channel = cn.Code
                        LEFT JOIN dbo.AR_ShopType sh WITH(NOLOCK) ON sh.Channel = cn.Code
                                                              AND sh.Code = c.ShopType
						left join 	[SI_Ward]	w1 with(nolock) on c.State=w1.State and c.District=w1.District and c.ward=w1.ward 
						left join 	SI_District	w2 with(nolock) on c.State=w2.State and c.District=w2.District --and c.Country=w2.Country			  
                        LEFT JOIN dbo.IN_Inventory ii WITH(NOLOCK) ON ii.InvtID = pd.InvtID
                        INNER JOIN ( SELECT k.InvtID ,
                                            k.CnvFact ,
                                            u.FromUnit ,
                                            u.ToUnit
                                     FROM   ( SELECT DISTINCT
                                                        InvtID ,
                                                        CnvFact = MAX(CnvFact)
                                              FROM      dbo.IN_UnitConversion WITH(NOLOCK)
                                              WHERE     UnitType = 3
                                              GROUP BY  InvtID
                                            ) k
                                            INNER JOIN dbo.IN_UnitConversion  u WITH(NOLOCK) ON u.InvtID = k.InvtID
                                                              AND u.CnvFact = k.CnvFact
                                   ) b ON b.InvtID = ii.InvtID
                        INNER JOIN dbo.vs_IN_Hierrachy hi  ON hi.InvtID = pd.InvtID
              WHERE   
			  ot.INDocType='CM'  
			  AND 
			  cast( op.OrderDate  as date) BETWEEN cast(@Fromdate as date) AND cast(@Todate as date)
			  UNION ALL
			SELECT  
			NgayDatHang = CONVERT(VARCHAR, op.OrderDate, 103) ,
			SoHDDatHang = '' ,  
			NgayGiao = CASE WHEN op.shipdate='1900-01-01 00:00:00' THEN '' ELSE CONVERT(VARCHAR, op.shipdate, 103) END ,
            MaVung = vs.Territory ,
            TenVung = st.Descr ,
            MaTinhNPP = vs.State ,
            TinhNPP = t.Descr ,
            MaTinhKH = c.State ,
            TenTinhKH = tt.Descr ,
            MaNPP = op.BranchID,
            TenNPP = vs.CpnyName ,
            DiaChiNPP = vs.Address ,
            SlsPerID = op.SlsPerID ,
            SlsName = s.Name ,
			Position= CASE WHEN s.Position  = 'S' THEN dbo.fr_GetLang(@LangID,'RPSalesPerson') 
												WHEN s.Position  = 'SS' THEN dbo.fr_GetLang(@LangID,'RPSalesSup') 
												WHEN s.Position  = 'ASM' THEN dbo.fr_GetLang(@LangID,'RPAreaSalesMan') 
												WHEN s.Position  = 'RSM' THEN dbo.fr_GetLang(@LangID,'RPRegionalDir') 
												WHEN s.Position  = 'FFD' THEN dbo.fr_GetLang(@LangID,'ZSM') 
												ELSE ''
												END,
			SoHoaDon = ISNULL(op.OrderNbr,'') ,   
            CustID = op.CustID ,
            CustName = c.CustName ,
            CustAddr = concat(c.Addr1,' ',c.Addr2,' ',w1.name,' ',w2.name,' ',tt.Descr)  ,
            Channel = c.Channel ,
            ChannelName = cn.Descr,
            ShopType = c.ShopType,
            ShopTypeName = sh.Descr ,
            InvtID = pd.InvtID ,
            InvtName = ii.Descr ,
            NganhHangDesc =hi.NganhHangDesc ,
            PhanKhucName = hi.HangName,
            NhomHangName =  hi.NhanHangName,
			OrderType = CASE WHEN ot.INDocType='IN' Then dbo.fr_GetLang(@LangID,'SaleOrder')  
							 ELSE dbo.fr_GetLang(@LangID,'AppforPaym')  
							 END,
            LoaiHang = CASE WHEN pd.FreeItem=0 THEN dbo.fr_GetLang(@LangID,'SaleItem')  
						   WHEN pd.FreeItem=1 AND pd.DisplayID = ''THEN dbo.fr_GetLang(@LangID,'RPFreeItem') 
						   WHEN pd.FreeItem=1 AND pd.DisplayID <> '' THEN dbo.fr_GetLang(@LangID,'RetOnDisplay') 
						   ELSE ''
						   END,
            DonViThung = b.FromUnit ,
            DonViLe = b.ToUnit ,
            QuyCach = b.CnvFact,
            SanluongThungDat =  ISNULL((pd.LineQty * pd.UnitRate ),0)
                        / ( dbo.fr_OM_GetCnvFact(pd.InvtID) ),
            SLLeDat = ISNULL(pd.LineQty * pd.UnitRate,0),
			SLThung =  CASE WHEN op.Status='C' THEN  (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*(ISNULL(pd.LineQty * pd.UnitRate,0) ) / ( dbo.fr_OM_GetCnvFact(pd.InvtID) ) ELSE 0 END,
            SLLeGiao =CASE WHEN op.Status='C' THEN (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(pd.LineQty * pd.UnitRate,0) ELSE 0 END ,
            OrderAmt = CASE WHEN pd.FreeItem=0 THEN ISNULL(pd.LineQty*pd.SlsPrice,0) - ISNULL(pd.DiscAmt,0) ELSE 0 END,
			ShipAmt = CASE WHEN op.Status='C' THEN (CASE WHEN pd.FreeItem=0 THEN (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(pd.LineQty*pd.SlsPrice,0) - (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(pd.DiscAmt,0) ELSE 0 END)ELSE 0 END,
			DiscAmtOrd = ISNULL(pd.DiscAmt,0),
			DiscAmtShip = CASE WHEN op.Status='C' THEN  (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(pd.DiscAmt,0) ELSE 0 END,
            DTD = CASE WHEN op.Status='C' THEN  CASE WHEN pd.FreeItem=0 THEN ISNULL(pd.LineQty*pd.SlsPrice,0) ELSE 0 END ELSE 0 END,
			DTTG = CASE WHEN op.Status='C' THEN (CASE WHEN pd.FreeItem=0 THEN (CASE WHEN ot.INDocType='IN' THEN 1 ELSE -1 END)*ISNULL(pd.LineQty*pd.SlsPrice,0) ELSE 0 END) ELSE 0 END,
			Status=  CASE WHEN op.Status =  'O' THEN N'Đặt Hàng'
							WHEN op.Status =  'C' THEN N'Đã giao hàng'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='' THEN N'Đã gửi NPP'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='M' THEN N'Đã xác nhận'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='Q' THEN N'Giao hàng không thành công'
							WHEN op.Status = 'H' AND ISNULL(op.DeliveryStatus,'')='S' THEN N'Đã xem'
							WHEN op.Status  IN(  'E','V') THEN N'Đã Hủy'
							WHEN op.Status IN(  'H','N') THEN  N'Chờ Xử Lý'
							WHEN  op.Status  IN(  'E','V') THEN dbo.fr_GetLang(@LangID,'CloseOrder') 
							WHEN op.Status =  'I' THEN N'Đã Xác Nhận'
							WHEN op.Status =  'P' THEN N'Đang Xử Lý'
							WHEN op.Status =  'T' THEN N'Phân Bổ Giao Hàng'
							ELSE ''
								END 
			,[NoteNV]=op.Remark
			,[NoteDH] =op.RemarkOrder

    FROM     dbo.OM_SalesOrd op WITH(NOLOCK) 
						INNER JOIN dbo.OM_SalesOrdDet pd WITH(NOLOCK) ON pd.BranchID = op.BranchID AND pd.OrderNbr = op.OrderNbr  and pd.posm =''
						INNER JOIN dbo.OM_OrderType ot WITH(NOLOCK) ON ot.OrderType = op.OrderType
						INNER JOIN #Groups g WITH(NOLOCK) ON g.BranchID=op.BranchID AND g.OrderNbr=op.OrderNbr	
						LEFT JOIN dbo.AR_Customer c WITH(NOLOCK) ON c.BranchID = op.BranchID
                                                              AND c.CustId = op.CustID
                        LEFT JOIN dbo.vs_Company vs WITH(NOLOCK) ON op.BranchID = vs.CpnyID
                        LEFT JOIN dbo.SI_Territory st WITH(NOLOCK) ON vs.Territory = st.Territory
						LEFT JOIN dbo.SI_SubTerritory sst WITH(NOLOCK) ON sst.Territory = st.Territory AND vs.Owner=sst.Code OR sst.Territory='ALL'
                        LEFT JOIN dbo.SI_State t WITH(NOLOCK) ON vs.State = t.State
                        LEFT JOIN dbo.SI_State tt WITH(NOLOCK) ON c.State = tt.State
                        INNER JOIN dbo.AR_Salesperson s WITH(NOLOCK) ON s.BranchID = op.BranchID
                        AND s.SlsperId = op.SlsPerID
                        LEFT JOIN dbo.AR_Channel cn WITH(NOLOCK) ON c.Channel = cn.Code
                        LEFT JOIN dbo.AR_ShopType sh WITH(NOLOCK) ON sh.Channel = cn.Code
                                                              AND sh.Code = c.ShopType
						left join 	[SI_Ward]	w1 with(nolock) on c.State=w1.State and c.District=w1.District and c.ward=w1.ward 
						left join 	SI_District	w2 with(nolock) on c.State=w2.State and c.District=w2.District 	
                        LEFT JOIN dbo.IN_Inventory ii WITH(NOLOCK) ON ii.InvtID = pd.InvtID
                        INNER JOIN ( SELECT k.InvtID ,
                                            k.CnvFact ,
                                            u.FromUnit ,
                                            u.ToUnit
                                     FROM   ( SELECT DISTINCT
                                                        InvtID ,
                                                        CnvFact = MAX(CnvFact)
                                              FROM      dbo.IN_UnitConversion WITH(NOLOCK)
                                              WHERE     UnitType = 3
                                              GROUP BY  InvtID
                                            ) k
                                            INNER JOIN dbo.IN_UnitConversion u WITH(NOLOCK) ON u.InvtID = k.InvtID
                                                              AND u.CnvFact = k.CnvFact
                                   ) b ON b.InvtID = ii.InvtID
                        INNER JOIN dbo.vs_IN_Hierrachy hi ON hi.InvtID = pd.InvtID
              WHERE   
			  CAST( op.OrderDate  as date) BETWEEN cast(@Fromdate as date) AND cast(@Todate as date)-- and op.Status not in ('C','E')
			   AND
			   OP.Crtd_Prog='OM10100'
			   AND  ot.INDocType <> 'CM'   

DROP TABLE #Groups

