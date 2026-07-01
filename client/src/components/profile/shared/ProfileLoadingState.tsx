import { Loading } from "@carbon/react";
import styles from "./profile.module.scss";


export function ProfileLoadingState() {
  return (
    <div className={`${styles.sectionCard} ${styles.profileLoadingState}`}>
      <Loading withOverlay={false} />
      <p className={styles.profileLoadingText}>Loading profile activity...</p>
    </div>
  );
}

export default ProfileLoadingState;
