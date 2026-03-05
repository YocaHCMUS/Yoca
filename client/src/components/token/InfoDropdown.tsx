import { ChevronDown } from "@carbon/icons-react";
import React, { useEffect, useRef, useState } from "react";
import styles from "./InfoDropdown.module.scss";

export interface InfoDropdownItem {
    label: string;
    url?: string;
}

interface InfoDropdownProps {
    items: InfoDropdownItem[];
    defaultLabel?: string;
}

export const InfoDropdown: React.FC<InfoDropdownProps> = ({ items, defaultLabel }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    if (!items || items.length === 0) return null;

    const handleToggle = () => setIsOpen(!isOpen);

    // If there's only one item and no defaultLabel, just show it as a simple badge
    if (items.length === 1 && !defaultLabel) {
        const item = items[0];
        if (item.url) {
            return (
                <a className={styles.badgeSingle} href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.label}
                </a>
            );
        }
        return <span className={styles.badgeSingle}>{item.label}</span>;
    }

    const mainLabel = defaultLabel || items[0].label;

    return (
        <div className={styles.dropdownContainer} ref={containerRef}>
            <button
                className={`${styles.dropdownTrigger} ${isOpen ? styles.open : ""}`}
                onClick={handleToggle}
                type="button"
            >
                <span className={styles.triggerLabel}>{mainLabel}</span>
                <span className={styles.triggerIconBox}>
                    <ChevronDown size={14} className={styles.icon} />
                </span>
            </button>

            {isOpen && (
                <div className={styles.dropdownMenu}>
                    {items.map((item, idx) => (
                        <React.Fragment key={idx}>
                            {item.url ? (
                                <a
                                    href={item.url}
                                    className={styles.dropdownItem}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setIsOpen(false)}
                                >
                                    {item.label}
                                </a>
                            ) : (
                                <div className={styles.dropdownItem}>{item.label}</div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};
