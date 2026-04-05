
import styles from './WalletOverview.module.scss';
import { SkeletonPlaceholder } from '@carbon/react';

export const renderValue = (
    hasValue: boolean,
    formattedValue: React.ReactNode,
    classNames: string[],
    skeletonWidth: string,
    skeletonHeight: string,
    loading: boolean
) => {
    const className = classNames.join(' ');

    if (hasValue) {
        return <span className={className}>{formattedValue}</span>;
    }

    if (loading) {
        return (
            <div className={styles.valueSkeleton} aria-hidden="true">
                <SkeletonPlaceholder
                    style={{
                        width: skeletonWidth,
                        height: skeletonHeight,
                        borderRadius: '4px',
                    }}
                />
            </div>
        );
    }

    return <span className={className}>{formattedValue}</span>;
};
