import styles from "./profile.module.scss";

interface ProfileUnavailableStateProps {
    title?: string;
    description?: string;
}

export function ProfileUnavailableState({
    title = "Data unavailable",
    description = "No profile data is available right now.",
}: ProfileUnavailableStateProps) {
    return (
        <div className={`${styles.sectionCard} ${styles.unavailableState}`}>
            <h3 className={styles.unavailableTitle}>{title}</h3>
            <p className={styles.unavailableDescription}>{description}</p>
        </div>
    );
}

export default ProfileUnavailableState;