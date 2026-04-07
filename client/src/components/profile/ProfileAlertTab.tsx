import { PROFILE_ALERT_NAV_LABELS } from "@/components/profile/profile.constants";
import type { ProfileAlertNav, ProfileAlertsData } from "@/types/profile";
import {
    Button,
    Select,
    SelectItem,
    TextArea,
    TextInput,
    Toggle,
} from "@carbon/react";
import { useState } from "react";
import styles from "./profile.module.scss";

interface ProfileAlertTabProps {
    data: ProfileAlertsData;
}

export function ProfileAlertTab({ data }: ProfileAlertTabProps) {
    const [selectedNav, setSelectedNav] = useState<ProfileAlertNav>(data.selectedNav);

    return (
        <section className={styles.tabLayout3}>
            <aside className={`${styles.sectionCard} ${styles.sideNav}`}>
                <h3>Alerts</h3>
                {data.leftNavItems.map((nav) => (
                    <Button
                        key={nav}
                        size="sm"
                        kind={selectedNav === nav ? "primary" : "tertiary"}
                        className={styles.sideNavButton}
                        onClick={() => setSelectedNav(nav)}
                    >
                        {PROFILE_ALERT_NAV_LABELS[nav]}
                    </Button>
                ))}
            </aside>

            <div className={`${styles.sectionCard} ${styles.contentStack}`}>
                {selectedNav === "list" ? (
                    <>
                        <div>
                            <Button size="sm">Add alert</Button>
                        </div>
                        <table className={styles.simpleTable}>
                            <thead>
                                <tr>
                                    <th>Token</th>
                                    <th>Type</th>
                                    <th>Condition</th>
                                    <th>Status</th>
                                    <th>Updated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.alerts.map((rule) => (
                                    <tr key={rule.id}>
                                        <td>{rule.tokenSymbol}</td>
                                        <td>{rule.alertType}</td>
                                        <td>{rule.conditionText}</td>
                                        <td>{rule.status}</td>
                                        <td>{new Date(rule.updatedAt).toLocaleString()}</td>
                                        <td>
                                            <Button size="sm" kind="ghost">
                                                Edit
                                            </Button>
                                            <Button size="sm" kind="ghost">
                                                Pause/Resume
                                            </Button>
                                            <Button size="sm" kind="ghost">
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                ) : (
                    <form className={styles.contentStack}>
                        <TextInput id="alert-token" labelText="Token" placeholder="SOL" />
                        <Select id="alert-type" labelText="Alert type" defaultValue="price">
                            <SelectItem value="price" text="Price" />
                            <SelectItem value="volume" text="Volume" />
                            <SelectItem value="drawdown" text="Drawdown" />
                            <SelectItem value="custom" text="Custom" />
                        </Select>
                        <TextInput
                            id="alert-condition"
                            labelText="Condition"
                            placeholder="Price > 210"
                        />
                        <TextArea id="alert-channels" labelText="Channels" placeholder="Email, Telegram" />
                        <Toggle
                            id="alert-enabled"
                            labelText="Enable alert"
                            labelA="Disabled"
                            labelB="Enabled"
                            defaultToggled
                        />
                        <div>
                            <Button type="button" size="sm">
                                Save alert
                            </Button>
                        </div>
                    </form>
                )}
            </div>

            <aside className={`${styles.sectionCard} ${styles.contentStack}`}>
                <h3>Notifications</h3>
                {data.notifications.map((note) => (
                    <article key={note.id} className={styles.notificationItem}>
                        <strong>{note.severity.toUpperCase()}</strong>
                        <p>{note.message}</p>
                        <small>{new Date(note.timestamp).toLocaleString()}</small>
                    </article>
                ))}
            </aside>
        </section>
    );
}

export default ProfileAlertTab;
