import React, { CSSProperties } from "react";
import styles from "./tabContainer.module.scss";

export type tabIndex = number;

export interface TabContainerProps {
  activeTab: tabIndex;
  names: string[];
  tabIcons?: React.ReactNode[];
  tabs: React.ReactNode[];
  onTabChange?: (index: tabIndex) => void;
  actions?: React.ReactNode;
  /**
   * Keep panels for visited tabs mounted but hidden instead of unmounting them.
   * Pair with `visitedTabIndices` and per-tab `fetchEnabled` to avoid refetch/API storms when switching tabs.
   */
  preserveMountedPanels?: boolean;
  /** Tab indices that have been opened at least once; only those panels render when preserveMountedPanels is true. */
  visitedTabIndices?: ReadonlySet<number>;
  /** Tab orientation: 'horizontal' (default) places tabs on top, 'vertical' places tabs on left */
  orientation?: "horizontal" | "vertical";
  style?: CSSProperties;
}

export const TabContainer: React.FC<TabContainerProps> = ({
  activeTab,
  names,
  tabIcons,
  tabs,
  onTabChange,
  actions,
  preserveMountedPanels = false,
  visitedTabIndices,
  orientation = "horizontal",
  style,
}) => {
  const hasActions = Boolean(actions);
  const isVertical = orientation === "vertical";

  return (
    <div
      className={`${styles.tabContainer} ${isVertical ? styles.tabContainerVertical : ""}`.trim()}
      style={style}
    >
      {/* Tab Headers */}
      <div
        className={`${styles.tabHeaders} ${hasActions ? styles.tabHeadersWithActions : ""} ${isVertical ? styles.tabHeadersVertical : ""}`.trim()}
      >
        <div
          className={`${styles.tabHeaderTabs} ${isVertical ? styles.tabHeaderTabsVertical : ""}`.trim()}
        >
          {names.map((name, index) => (
            <button
              key={index}
              onClick={() => onTabChange?.(index)}
              className={
                activeTab === index ? styles.tabButtonActive : styles.tabButton
              }
            >
              <span className={styles.tabButtonInner}>
                {tabIcons?.[index] ? (
                  <span className={styles.tabButtonIcon} aria-hidden="true">
                    {tabIcons[index]}
                  </span>
                ) : null}
                <span>{name}</span>
              </span>
            </button>
          ))}
        </div>
        {hasActions ? (
          <div className={styles.tabHeaderActions}>{actions}</div>
        ) : null}
      </div>

      {/* Tab Content */}
      <div
        className={`${styles.tabContent} ${isVertical ? styles.tabContentVertical : ""}`.trim()}
      >
        {preserveMountedPanels && visitedTabIndices
          ? tabs.map((tab, index) => {
              if (!visitedTabIndices.has(index)) {
                return null;
              }
              return (
                <div
                  key={index}
                  role="tabpanel"
                  hidden={activeTab !== index}
                  className={styles.tabPanelPreserve}
                >
                  {tab}
                </div>
              );
            })
          : tabs[activeTab]}
      </div>
    </div>
  );
};

export default TabContainer;
