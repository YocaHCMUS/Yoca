import { Globe, FileText, Users, Code, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./TokenInfo.module.scss";

interface SocialLinks {
    homepage?: string[];
    whitepaper?: string;
    twitter_screen_name?: string;
    facebook_username?: string;
    telegram_channel_identifier?: string;
    subreddit_url?: string;
    repos_url?: {
        github?: string[];
    };
}

interface TokenInfoProps {
    description?: string | null;
    network?: string;
    contractAddress?: string;
    coingeckoId?: string | null;  // To fetch additional data
    initialLinks?: SocialLinks;
}

export const TokenInfo = ({ description, network, contractAddress, coingeckoId, initialLinks }: TokenInfoProps) => {
    const [socialLinks, setSocialLinks] = useState<SocialLinks | null>(initialLinks || null);
    const [loading, setLoading] = useState(false);

    // Fetch additional details from CoinGecko if coingeckoId is provided
    useEffect(() => {
        if (!coingeckoId || initialLinks) return;

        (async () => {
            setLoading(true);
            try {
                const response = await fetch(
                    `https://api.coingecko.com/api/v3/coins/${coingeckoId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
                    {
                        headers: {
                            accept: "application/json",
                            "x-cg-demo-api-key": "CG-MjPFyX8QAo68K93S65PHjrki",
                        },
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    setSocialLinks(data.links || null);
                }
            } catch (error) {
                console.error("Failed to fetch token links:", error);
            } finally {
                setLoading(false);
            }
        })();
    }, [coingeckoId, initialLinks]);

    const website = socialLinks?.homepage?.[0];
    const twitter = socialLinks?.twitter_screen_name
        ? `https://twitter.com/${socialLinks.twitter_screen_name}`
        : undefined;
    const telegram = socialLinks?.telegram_channel_identifier
        ? `https://t.me/${socialLinks.telegram_channel_identifier}`
        : undefined;
    const reddit = socialLinks?.subreddit_url;
    const github = socialLinks?.repos_url?.github?.[0];

    const communityLinks = [
        { name: "Twitter", url: twitter, icon: "𝕏" },
        { name: "Telegram", url: telegram, icon: "✈️" },
        { name: "Reddit", url: reddit, icon: "📱" },
    ].filter(link => link.url);

    const sourceCodeLinks = [
        { name: "Github", url: github, icon: <Code size={16} /> },
    ].filter(link => link.url);

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Loading token info...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Description Section */}
            {description && (
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>Description</h3>
                    <p className={styles.description}>{description}</p>
                </div>
            )}

            {/* Main Links */}
            {website && (
                <div className={styles.section}>
                    <div className={styles.linkGrid}>
                        <a
                            href={website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.mainLink}
                        >
                            <Globe size={16} />
                            <span>Website</span>
                            <ExternalLink size={14} className={styles.externalIcon} />
                        </a>
                    </div>
                </div>
            )}

            {/* Network & Contract */}
            {(network || contractAddress) && (
                <div className={styles.section}>
                    {network && (
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Network</span>
                            <span className={styles.infoValue}>{network}</span>
                        </div>
                    )}
                    {contractAddress && (
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Onchain Address</span>
                            <span className={styles.infoValue} title={contractAddress}>
                                {contractAddress.slice(0, 8)}...{contractAddress.slice(-6)}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Community Links */}
            {communityLinks.length > 0 && (
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        <Users size={16} />
                        Community
                    </h3>
                    <div className={styles.linkList}>
                        {communityLinks.map(link => (
                            <a
                                key={link.name}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.socialLink}
                            >
                                <span className={styles.socialIcon}>{link.icon}</span>
                                <span>{link.name}</span>
                                <ExternalLink size={12} className={styles.externalIcon} />
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Source Code */}
            {sourceCodeLinks.length > 0 && (
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>
                        <Code size={16} />
                        Source Code
                    </h3>
                    <div className={styles.linkList}>
                        {sourceCodeLinks.map(link => (
                            <a
                                key={link.name}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.socialLink}
                            >
                                {link.icon}
                                <span>{link.name}</span>
                                <ExternalLink size={12} className={styles.externalIcon} />
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
