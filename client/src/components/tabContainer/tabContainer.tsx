import React from 'react';

export type tabIndex = number;

export interface TabContainerProps {
    activeTab: tabIndex;
    names: string[];
    tabs: React.ReactNode[];
    onTabChange?: (index: tabIndex) => void;
}

export const TabContainer: React.FC<TabContainerProps> = ({
    activeTab,
    names,
    tabs,
    onTabChange
}) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', paddingLeft: '16px', paddingRight: '16px' }}>
            {/* Tab Headers */}
            <div style={{ 
                display: 'flex', 
                borderBottom: '1px solid #e0e0e0',
                gap: '0',
                background: '#f4f4f4'
            }}>
                {names.map((name, index) => (
                    <button
                        key={index}
                        onClick={() => onTabChange?.(index)}
                        style={{
                            flex: '1',
                            alignContent: 'center',
                            justifyContent: 'center',
                            padding: '14px 16px',
                            border: 'none',
                            background: activeTab === index ? '#ffffff' : 'transparent',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: activeTab === index ? '600' : 'normal',
                            color: activeTab === index ? '#161616' : '#525252',
                            borderBottom: activeTab === index ? '3px solid #0f62fe' : '3px solid transparent',
                            transition: 'all 0.11s',
                            letterSpacing: '0.16px',
                            textTransform: 'none',
                            position: 'relative',
                            minHeight: '48px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== index) {
                                e.currentTarget.style.background = '#e8e8e8';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== index) {
                                e.currentTarget.style.background = 'transparent';
                            }
                        }}
                    >
                        {name}
                    </button>
                ))}
            </div>
            
            {/* Tab Content */}
            <div style={{ padding: '0' }}>
                {tabs[activeTab]}
            </div>
        </div>
    );
}

export default TabContainer;