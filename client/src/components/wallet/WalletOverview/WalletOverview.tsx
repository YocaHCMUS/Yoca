

export interface WalletOverviewProps {
    walletAddress: string,
    height?: number;
    initialFilters?: Partial<any>;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export const WalletOverview: React.FC<WalletOverviewProps> = ({
    walletAddress = "null",
    height = 400,
    initialFilters,
    autoRefresh = true,
    refreshInterval = 30000
}) => {
    // mock data, need to create a hook to fetch these information
    const name = "Wallet A"; 
    const tags = ["whale", "early x holder", "early y holder", "metamask user"];
    const totalAssetValue = 14199;
    const tradingVolumn = 1822333;
    const totalPnL = 140000;
    const transactionCount = 1133;
    const tokenTraded = 54;
    const numberOfTokenHolding = 32;

    return (
        // main container: column
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '20px' }}>
            {/* 1st row: row containing 3 columns */}
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}> 
                {/* 1st column: profile picture */}
                <div style={{ flexShrink: 0 }}>
                    <div style={{ 
                        width: '80px', 
                        height: '80px', 
                        borderRadius: '50%', 
                        backgroundColor: '#e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color: '#666'
                    }}>
                        {name.charAt(0)}
                    </div>
                </div>
                
                {/* 2nd column: basic profile information (name, wallet address, tags) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{name}</h2>
                    <h3 style={{ 
                        fontSize: '14px', 
                        color: '#666',
                        fontFamily: 'monospace'
                    }}>
                        {walletAddress}
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {tags.map((tag, index) => (
                            <span 
                                key={index}
                                style={{
                                    padding: '4px 12px',
                                    backgroundColor: '#f0f0f0',
                                    borderRadius: '16px',
                                    fontSize: '12px',
                                    color: '#333'
                                }}
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
                
                {/* 3rd column: 1st line: filter buttons ; 2nd line: utilities links (bookmark, create alert, share, compare) */}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: '200px', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'row-reverse' }}>
                        <button style={{ 
                            padding: '6px 16px', 
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            background: '#fff',
                            cursor: 'pointer'
                        }}>
                            24H
                        </button>
                        <button style={{ 
                            padding: '6px 16px', 
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            background: '#fff',
                            cursor: 'pointer'
                        }}>
                            7D
                        </button>
                        <button style={{ 
                            padding: '6px 16px', 
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            background: '#fff',
                            cursor: 'pointer'
                        }}>
                            30D
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '14px', flexDirection: 'row-reverse' }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066cc' }}>
                            📌 Bookmark
                        </button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066cc' }}>
                            🔔 Alert
                        </button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066cc' }}>
                            📤 Share
                        </button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0066cc' }}>
                            ⚖️ Compare
                        </button>
                    </div>
                </div>
            </div>
            
            {/* 2nd row: row containing 6 columns, separated by a line*/}
            <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '24px' }}>
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '0'
                }}>
                    {/* Total Asset Value */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 24px', borderRight: '1px solid #e0e0e0' }}>
                        <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>
                            Total Asset Value
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                            ${totalAssetValue.toLocaleString()}
                        </div>
                    </div>
                    
                    {/* Trading Volume */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 24px', borderRight: '1px solid #e0e0e0' }}>
                        <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>
                            Trading Volume
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                            ${tradingVolumn.toLocaleString()}
                        </div>
                    </div>
                    
                    {/* Total PnL */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 24px', borderRight: '1px solid #e0e0e0' }}>
                        <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>
                            Total PnL
                        </div>
                        <div style={{ 
                            fontSize: '24px', 
                            fontWeight: 'bold',
                            color: totalPnL >= 0 ? '#00c853' : '#ff1744'
                        }}>
                            ${totalPnL.toLocaleString()}
                        </div>
                    </div>
                    
                    {/* Transaction Count */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 24px', borderRight: '1px solid #e0e0e0' }}>
                        <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>
                            Transactions
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                            {transactionCount.toLocaleString()}
                        </div>
                    </div>
                    
                    {/* Token Traded */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 24px', borderRight: '1px solid #e0e0e0' }}>
                        <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>
                            Tokens Traded
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                            {tokenTraded}
                        </div>
                    </div>
                    
                    {/* Tokens Holding */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 24px' }}>
                        <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>
                            Tokens Holding
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                            {numberOfTokenHolding}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default WalletOverview;