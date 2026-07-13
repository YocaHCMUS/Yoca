import styles from "./profile.module.scss";

interface ProfileUnavailableStateProps {
    title?: string;
    description?: string;
}

export function ProfileUnavailableState({
    title,
    description,
}: ProfileUnavailableStateProps) {
    const displayTitle = title;
    const displayDescription = description;

    return (
        <div className={`${styles.sectionCard} ${styles.unavailableState}`}>
            <h3 className={styles.unavailableTitle}>{displayTitle}</h3>
            <p className={styles.unavailableDescription}>{displayDescription}</p>
        </div>
    );
}

export default ProfileUnavailableState;