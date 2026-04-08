import React from "react";
import styles from "./tabContainer.module.scss";

export type tabIndex = number;

export interface TabContainerProps {
  activeTab: tabIndex;
  names: string[];
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
}

export const TabContainer: React.FC<TabContainerProps> = ({
  activeTab,
  names,
  tabs,
  onTabChange,
  actions,
  preserveMountedPanels = false,
  visitedTabIndices,
}) => {
  const hasActions = Boolean(actions);

  return (
    <div className={styles.tabContainer}>
      {/* Tab Headers */}
      <div
        className={`${styles.tabHeaders} ${hasActions ? styles.tabHeadersWithActions : ""}`.trim()}
      >
        <div className={styles.tabHeaderTabs}>
          {names.map((name, index) => (
            <button
              key={index}
              onClick={() => onTabChange?.(index)}
              className={
                activeTab === index ? styles.tabButtonActive : styles.tabButton
              }
            >
              {name}
            </button>
          ))}
        </div>
        {hasActions ? (
          <div className={styles.tabHeaderActions}>{actions}</div>
        ) : null}
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
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
