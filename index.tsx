import React, { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse, Chat, Type } from "@google/genai";

type Page = 'dashboard' | 'my-projects' | 'settings' | 'my-account-profile' | 'billing' | 'plans-pricing' | 'e-commerce-redaction' | 'faq-generator' | 'summary-table-generator' | 'roadmap-dev' | 'summary' | 'online-help' | 'competitive-analysis' | 'product-page-analysis' | 'cro-optimization' | 'specs-for-dev' | 'search-intentions';

interface NavItem {
    id: Page | string; // Allow string for non-Page IDs
    label: string;
    href: string;
    active?: boolean;
    dropdown?: boolean;
}

// --- Helper Functions ---
const loadFromLocalStorage = <T,>(key: string, defaultValue: T): T => {
    try {
        const storedValue = localStorage.getItem(key);
        return storedValue ? JSON.parse(storedValue) as T : defaultValue;
    } catch (e) {
        console.warn(`Error loading '${key}' from localStorage:`, e);
        return defaultValue;
    }
};

const saveToLocalStorage = <T,>(key: string, value: T): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`Error saving '${key}' to localStorage:`, e);
    }
};

const extractJsonFromResponse = (responseText: string): any => {
    let cleanedText = responseText.trim();
    const jsonMatch = cleanedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
        cleanedText = jsonMatch[1];
    }
    return JSON.parse(cleanedText);
};

const handleCopy = (text: string, e: React.MouseEvent<HTMLButtonElement>) => {
    navigator.clipboard.writeText(text);
    const button = e.currentTarget;
    const originalText = button.textContent;
    button.textContent = 'Copié !';
    button.disabled = true;
    setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
    }, 2000);
};


// --- Project Data Structure ---
type CMS = 'woocommerce' | 'shopify' | 'prestashop' | 'bigcommerce' | 'other';

interface Project {
    id: string;
    name: string;
    url: string;
    cms?: CMS;
    creationDate: string; // ISO string date
    gscConnected?: boolean;
    gaConnected?: boolean;
}
const LOCAL_STORAGE_PROJECTS = 'semanticAppProjects';
// --- End Project Data Structure ---


// --- Search Intentions Data ---
interface SearchIntention {
    query: string;
    [key: string]: any; // To accommodate various CSV columns
}
const LOCAL_STORAGE_SEARCH_INTENTIONS_PREFIX = 'semanticAppSearchIntentions_';
// --- End Search Intentions Data ---


// --- My Account Profile Data ---
interface UserProfileData {
    firstName: string;
    lastName: string;
    email: string;
    language: string;
    stripeCustomerId?: string;
}
const LOCAL_STORAGE_USER_PROFILE = 'userProfileData';
// --- End My Account Profile Data ---

const languageOptions = [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'de', label: 'Deutsch' },
    { value: 'it', label: 'Italiano' },
    { value: 'pt', label: 'Português' },
];


// --- Collaborator Data Structure ---
interface Collaborator {
    id: string;
    email: string;
    invitationDate: string; // ISO string date
    creditsUsedMock?: number;
    lastActivityMock?: string; // ISO string date
}
const LOCAL_STORAGE_COLLABORATORS = 'semanticAppCollaborators';
const MAX_COLLABORATORS = 5;
// --- End Collaborator Data Structure ---


// --- Pricing Plan Data Structure ---
interface PricingPlan {
    id: string;
    name: string;
    monthlyPrice: number;
    annualPrice: number;
    priceSubtitle?: string;
    credits: number | string;
    buttonText: string;
    buttonType: 'individual' | 'team' | 'enterprise';
    features: string[];
    bestValue?: boolean;
    isEnterprise?: boolean;
    description?: string;
    featuresIntro?: string;
}

const pricingPlans: PricingPlan[] = [
    {
        id: 'starter',
        name: 'STARTER',
        monthlyPrice: 9,
        annualPrice: 92,
        priceSubtitle: 'Pour démarrer et pour les petits besoins',
        credits: 250,
        buttonText: 'Commencer',
        buttonType: 'individual',
        features: [
            '250 Crédits/mois',
            'Plan de Contenu (3 niveaux): 100 crédits',
            'Rédaction d\'article: 20 crédits',
            'Optimisation d\'article: 20 crédits',
            'Génération de FAQ: 20 crédits',
            'Génération de Tableau: 20 crédits',
            '20 crédits d\'essai pour l\'Analyse SEO Avancée',
            'Gestion de 3 projets',
            'Support par email',
        ],
    },
    {
        id: 'pro',
        name: 'PRO',
        monthlyPrice: 49,
        annualPrice: 500,
        priceSubtitle: 'Idéal pour les freelances et PME',
        credits: 2000,
        buttonText: 'Choisir Pro',
        buttonType: 'team',
        bestValue: true,
        featuresIntro: 'Toutes les fonctionnalités du Plan Starter, plus :',
        features: [
            '2000 Crédits/mois',
            'Plan de Contenu (4 niveaux): 100 crédits',
            'Analyse SEO Avancée',
            'Éditeur avancé avec historique',
            'Gestion de 10 projets',
            'Support prioritaire par email',
        ],
    },
    {
        id: 'entreprise',
        name: 'ENTREPRISE',
        monthlyPrice: 99,
        annualPrice: 1010,
        priceSubtitle: 'Parfait pour les agences et les gros volumes',
        credits: 5000,
        buttonText: 'Choisir Entreprise',
        buttonType: 'enterprise',
        featuresIntro: 'Toutes les fonctionnalités du Plan Pro, plus :',
        features: [
            '5000 Crédits/mois',
            'Plan de Contenu (5 niveaux): 100 crédits',
            'Analyse SEO Avancée (SERP)',
            'Gestion de projets illimitée',
            'Gestion des collaborateurs (5)',
            'Accès aux nouvelles fonctionnalités en avant-première',
            'Support prioritaire par chat',
        ],
    },
    {
        id: 'sur-mesure',
        name: 'SUR MESURE',
        monthlyPrice: 0,
        annualPrice: 0,
        priceSubtitle: 'Pour les besoins très importants et l\'accès API',
        credits: 'Sur mesure',
        buttonText: 'Contacter-nous',
        buttonType: 'enterprise',
        isEnterprise: true,
        featuresIntro: 'Toutes les fonctionnalités du Plan Entreprise, plus :',
        features: [
            'Plus de 5000 Crédits/mois',
            'Accès API (bientôt disponible)',
            'Support dédié et onboarding personnalisé',
            'Accompagnement stratégique',
            'Développement de fonctionnalités sur mesure',
        ],
    }
];
// --- End Pricing Plan Data Structure ---


// --- Chatbot Interfaces ---
interface ChatMessage {
    id: string;
    sender: 'user' | 'ai' | 'system';
    text: string;
    timestamp: number;
}
type ListeningState = 'idle' | 'processing';
// --- End Chatbot Interfaces ---

// --- Sortable Table Hook ---
type SortDirection = 'ascending' | 'descending';

interface SortConfig<T> {
  key: keyof T;
  direction: SortDirection;
}

const useSortableData = <T extends object>(items: T[], config: SortConfig<T> | null = null) => {
    // FIX: Explicitly type the state to prevent TypeScript from inferring a too-narrow type from the initial `config`.
    const [sortConfig, setSortConfig] = React.useState<SortConfig<T> | null>(config);

    const sortedItems = React.useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const requestSort = (key: keyof T) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    return { items: sortedItems, requestSort, sortConfig };
};
// --- End Sortable Table Hook ---


const getPageTitle = (page: Page): string => {
    switch (page) {
        case 'dashboard': return 'Dashboard';
        case 'my-projects': return 'My Projects';
        case 'e-commerce-redaction': return "Rédaction Fiche E-commerce";
        case 'search-intentions': return 'Intentions de Recherches';
        case 'competitive-analysis': return "Analyse Concurrentielle";
        case 'product-page-analysis': return "Analyse Fiche Produit Concurrent";
        case 'cro-optimization': return "Optimisation CRO";
        case 'faq-generator': return "Générer une FAQ";
        case 'summary-table-generator': return "Générer un Tableau Récapitulatif";
        case 'settings': return 'Settings';
        case 'my-account-profile': return 'My Account Profile';
        case 'billing': return 'Billing';
        case 'plans-pricing': return 'Plans et Tarif';
        case 'roadmap-dev': return 'Roadmap de Développement';
        case 'summary': return 'Résumé & Personas';
        case 'online-help': return 'Aide en Ligne';
        case 'specs-for-dev': return 'Spécifications pour Développeur';
        default:
            const exhaustiveCheck: never = page;
            return exhaustiveCheck;
    }
};

type UserRole = 'main' | 'collaborator';
type UserPlan = 'starter' | 'pro' | 'entreprise';

// Concurrency Simulation
const ACTIVE_SESSION_KEY_PREFIX = 'semanticAppActiveSession_';
const CONCURRENCY_ERROR_MESSAGE = "Vous êtes déjà connecté à cette application sur une autre instance ou un autre onglet. Veuillez fermer les autres instances pour continuer.";


// --- Active Session Manager (Concurrency Check) ---
class ActiveSessionManager {
    private sessionId: string;
    private storageKey: string;
    private intervalId?: number;
    private onConflict: () => void;
    private isActiveSession: boolean = true;

    constructor(conflictCallback: () => void) {
        this.sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        this.storageKey = `${ACTIVE_SESSION_KEY_PREFIX}${this.sessionId}`;
        this.onConflict = conflictCallback;

        this.claimSession();
        this.setupListeners();
    }

    private claimSession() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(ACTIVE_SESSION_KEY_PREFIX)) {
                    localStorage.removeItem(key);
                }
            }
            localStorage.setItem(this.storageKey, 'active');
            this.isActiveSession = true;
        } catch (e) {
            console.warn("Could not access localStorage for session management:", e);
        }
    }

    private setupListeners() {
        window.addEventListener('beforeunload', () => {
            if (this.isActiveSession) {
                try {
                    localStorage.removeItem(this.storageKey);
                } catch (e) { /* ignore */ }
            }
        });

        this.intervalId = window.setInterval(() => {
            if (!this.isActiveSession) return;

            try {
                const currentClaim = localStorage.getItem(this.storageKey);
                if (currentClaim !== 'active') {
                    this.isActiveSession = false;
                    this.onConflict();
                    if (this.intervalId) clearInterval(this.intervalId);
                }
            } catch (e) {
                 console.warn("Error during periodic session check:", e);
            }
        }, 3000);
    }

    public isCurrentActiveSession(): boolean {
        return this.isActiveSession;
    }

    public releaseSession() {
        if (this.intervalId) clearInterval(this.intervalId);
        if (this.isActiveSession) {
             try {
                localStorage.removeItem(this.storageKey);
            } catch (e) { /* ignore */ }
        }
    }
}
// --- End Active Session Manager ---


// Initialize Gemini AI Client if API_KEY is available
let ai: GoogleGenAI | null = null;
if (process.env.API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch (error) {
        console.error("Error initializing GoogleGenAI:", error);
        ai = null;
    }
} else {
    console.warn("API_KEY environment variable not set. AI features will be disabled.");
}

// --- STICKY FOOTER COMPONENT ---
interface StickyFooterProps {
    creditCost: number;
    buttonText: string;
    onButtonClick: () => void;
    isButtonDisabled: boolean;
    buttonLoadingText?: string;
}

const StickyFooter: React.FC<StickyFooterProps> = ({ creditCost, buttonText, onButtonClick, isButtonDisabled, buttonLoadingText }) => {
    const isLoading = buttonLoadingText && isButtonDisabled;
    
    return (
        <div className="sticky-action-footer">
            <div className="footer-content-wrapper">
                <p className="footer-credit-cost">
                    Coût de l'action : <strong>{creditCost} crédits</strong>
                </p>
                <button onClick={onButtonClick} className="submit-button" disabled={isButtonDisabled}>
                    {isLoading ? <><span className="spinner"></span> {buttonLoadingText}</> : buttonText}
                </button>
            </div>
        </div>
    );
};
// --- END STICKY FOOTER COMPONENT ---

const App: React.FC = () => {
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [userRole, setUserRole] = useState<UserRole>('main');
    const [userPlan, setUserPlan] = useState<UserPlan>('pro'); // Set 'pro' as default for credit display
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [isConcurrencyError, setIsConcurrencyError] = useState(false);
    const sessionManagerRef = useRef<ActiveSessionManager | null>(null);
    const appContainerRef = useRef<HTMLDivElement>(null);
    const [isChatbotOpen, setIsChatbotOpen] = useState(false);
    
    // Mocked credits state
    const [credits, setCredits] = useState({ remaining: 1850, total: 2000 });


    const mockUserEmail = "user@example.com";

    useEffect(() => {
        if (!sessionManagerRef.current) {
            sessionManagerRef.current = new ActiveSessionManager(() => {
                setIsConcurrencyError(true);
            });
        }
        return () => {
            sessionManagerRef.current?.releaseSession();
        };
    }, []);

     useEffect(() => {
        if (appContainerRef.current) {
            if (isConcurrencyError) {
                appContainerRef.current.classList.add('concurrency-error-active');
            } else {
                appContainerRef.current.classList.remove('concurrency-error-active');
            }
        }
    }, [isConcurrencyError]);


    useEffect(() => {
        const profile = loadFromLocalStorage<UserProfileData | null>(LOCAL_STORAGE_USER_PROFILE, null);
        if (profile) {
            setUserProfile(profile);
        } else {
            const defaultProfile: UserProfileData = {
                firstName: "Utilisateur",
                lastName: "Principal",
                email: mockUserEmail,
                language: "fr",
                stripeCustomerId: undefined,
            };
            setUserProfile(defaultProfile);
            saveToLocalStorage(LOCAL_STORAGE_USER_PROFILE, defaultProfile);
        }
    }, []);


    const navigateTo = (page: Page) => {
        setCurrentPage(page);
        window.scrollTo(0, 0);
    };

    const handlePageNavigation = useCallback((page: Page) => {
        navigateTo(page);
    }, []);


    const handleProfileUpdate = useCallback((updatedProfile: UserProfileData) => {
        setUserProfile(updatedProfile);
        saveToLocalStorage(LOCAL_STORAGE_USER_PROFILE, updatedProfile);
    }, []);

    const handleSignOut = useCallback(() => {
        window.location.reload();
    }, []);

    const closeConcurrencyBanner = () => {
        setIsConcurrencyError(false);
    };

    const toggleChatbot = () => setIsChatbotOpen(!isChatbotOpen);

    return (
        <div ref={appContainerRef} className="app-container">
            {isConcurrencyError && (
                <div className="concurrency-error-banner" role="alertdialog" aria-labelledby="concurrencyErrorHeading" aria-describedby="concurrencyErrorDesc">
                    <strong id="concurrencyErrorHeading" style={{display:'block', marginBottom: '5px'}}>Accès Multiple Détecté</strong>
                    <p id="concurrencyErrorDesc">{CONCURRENCY_ERROR_MESSAGE}</p>
                    <button onClick={closeConcurrencyBanner} className="close-concurrency-error" aria-label="Fermer l'avertissement">&times;</button>
                </div>
            )}
            <Sidebar currentPage={currentPage} navigateTo={handlePageNavigation} userRole={userRole} userPlan={userPlan} />
            <MainWrapper
                currentPage={currentPage}
                navigateTo={navigateTo}
                userRole={userRole}
                userPlan={userPlan}
                userProfile={userProfile}
                onProfileUpdate={handleProfileUpdate}
                onSignOut={handleSignOut}
                userEmail={userProfile?.email || mockUserEmail}
                credits={credits}
            />
             {isUpgradeModalOpen && (
                <UpgradeModal
                    onClose={() => setIsUpgradeModalOpen(false)}
                    onUpgrade={() => {
                        setIsUpgradeModalOpen(false);
                        navigateTo('plans-pricing');
                    }}
                />
            )}
            {ai && (
                <button
                    className="chatbot-fab"
                    onClick={toggleChatbot}
                    aria-label={isChatbotOpen ? "Fermer l'assistant" : "Ouvrir l'assistant"}
                    title={isChatbotOpen ? "Fermer l'assistant" : "Ouvrir l'assistant"}
                >
                    {isChatbotOpen ? 'Fermer' : 'Assistant'}
                </button>
            )}
            {isChatbotOpen && ai && (
                <ChatbotModal
                    isOpen={isChatbotOpen}
                    onClose={toggleChatbot}
                    currentPage={currentPage}
                    navigateTo={navigateTo}
                    ai={ai}
                    userLanguage={userProfile?.language || 'fr'}
                />
            )}
        </div>
    );
};

// --- UpgradeModal Component ---
interface UpgradeModalProps {
    onClose: () => void;
    onUpgrade: () => void;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ onClose, onUpgrade }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Fonctionnalité Premium</h3>
                    <button className="close-modal-button" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <p>L'<strong>Analyse SEO Avancée</strong> est une fonctionnalité exclusive du plan <strong>Entreprise</strong>.</p>
                    <p>Passez au niveau supérieur pour débloquer cette fonctionnalité et obtenir des analyses concurrentielles approfondies, des suggestions de différenciation et des idées de contenu stratégiques.</p>
                </div>
                <div className="modal-footer">
                    <button className="button-secondary" onClick={onClose}>Plus Tard</button>
                    <button className="submit-button" onClick={onUpgrade}>Voir les Plans</button>
                </div>
            </div>
        </div>
    );
};

// --- ChatbotModal Component ---
interface ChatbotModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPage: Page;
    navigateTo: (page: Page) => void;
    ai: GoogleGenAI;
    userLanguage: string;
}

const getChatbotSystemInstruction = (page: Page): string => {
    // Default instruction
    let instruction = "You are a helpful assistant for the OtterCluster application. Help the user understand the current page and navigate if requested. If you suggest navigation, clearly state 'Okay, I will navigate you to the [Page Name] page.' or 'Navigating to [Page Name].'";

    switch (page) {
        case 'dashboard':
            instruction = "You are a dashboard assistant for OtterCluster. You can provide summaries of what's on the dashboard or help navigate to other sections like 'My Projects' or 'E-commerce Redaction'. If you suggest navigation, clearly state 'Okay, I will navigate you to the [Page Name] page.'";
            break;
        default:
            break;
    }
    return instruction;
};


const ChatbotModal: React.FC<ChatbotModalProps> = ({ isOpen, onClose, currentPage, navigateTo, ai, userLanguage }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [listeningState, setListeningState] = useState<ListeningState>('idle');
    const [chatbotError, setChatbotError] = useState<string | null>(null);
    const geminiChatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [textInputValue, setTextInputValue] = useState('');

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(scrollToBottom, [messages]);

    useEffect(() => {
        if (!isOpen) {
            setListeningState('idle');
            return;
        }

        if (!geminiChatRef.current && ai) {
            geminiChatRef.current = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: getChatbotSystemInstruction(currentPage),
                }
            });
        } else if (geminiChatRef.current) {
            geminiChatRef.current = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: getChatbotSystemInstruction(currentPage),
                }
            });
        }

        setMessages([{
            id: `system-${Date.now()}`,
            sender: 'system',
            text: `Assistant pour "${getPageTitle(currentPage)}" activé.`,
            timestamp: Date.now()
        }]);

    }, [isOpen, currentPage, ai]);

    const pageTitlesMap: Record<Page, string> = {
        'dashboard': 'Dashboard',
        'my-projects': 'My Projects',
        'search-intentions': 'Intentions de Recherches',
        'e-commerce-redaction': "Rédaction Fiche E-commerce",
        'competitive-analysis': 'Analyse Concurrentielle',
        'product-page-analysis': 'Analyse Fiche Produit Concurrent',
        'cro-optimization': 'Optimisation CRO',
        'faq-generator': "Générer une FAQ",
        'summary-table-generator': "Générer un Tableau Récapitulatif",
        'settings': 'Settings',
        'my-account-profile': 'My Account Profile',
        'billing': 'Billing',
        'plans-pricing': 'Plans et Tarif',
        'roadmap-dev': 'Roadmap de Développement',
        'summary': 'Résumé & Personas',
        'online-help': 'Aide en Ligne',
        'specs-for-dev': 'Spécifications pour Développeur',
    };
    
    const handleAiResponse = useCallback((aiText: string) => {
        setMessages(prev => [...prev, { id: `ai-${Date.now()}`, sender: 'ai', text: aiText, timestamp: Date.now() }]);
        setListeningState('idle');

        const navRegex = /navigate to the ([\w\s'-]+) page|navigating to ([\w\s'-]+)/i;
        const navMatch = aiText.match(navRegex);

        if (navMatch) {
            const pageNameQuery = (navMatch[1] || navMatch[2]).trim().toLowerCase();
            const pageEntries = Object.entries(pageTitlesMap) as [Page, string][];
            const foundPage = pageEntries.find(([_, title]) => title.toLowerCase() === pageNameQuery);

            if (foundPage) {
                setTimeout(() => navigateTo(foundPage[0]), 1000);
            } else {
                 console.warn("Chatbot tried to navigate to an unknown page title:", pageNameQuery);
            }
        }
    }, [navigateTo]);

    const processUserMessageWithAI = useCallback(async (userText: string) => {
        if (!geminiChatRef.current) {
            setChatbotError("Session de chat non initialisée.");
            setListeningState('idle');
            return;
        }
        setListeningState('processing');
        try {
            const response: GenerateContentResponse = await geminiChatRef.current.sendMessage({ message: userText });
            handleAiResponse(response.text);
        } catch (error: any) {
            console.error("Error sending message to Gemini:", error);
            const errText = `Erreur de l'assistant: ${error.message || 'Impossible de répondre.'}`;
            setMessages(prev => [...prev, { id: `ai-err-${Date.now()}`, sender: 'ai', text: errText, timestamp: Date.now() }]);
            setListeningState('idle');
            setChatbotError(errText);
        }
    }, [handleAiResponse]);

    const handleSendTextMessage = useCallback(() => {
        if (!textInputValue.trim()) return;
        setMessages(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: textInputValue, timestamp: Date.now() }]);
        processUserMessageWithAI(textInputValue);
        setTextInputValue('');
    }, [textInputValue, processUserMessageWithAI]);

    if (!isOpen) return null;

    let statusText = "Tapez votre message et appuyez sur Envoyer.";
    if (listeningState === 'processing') {
        statusText = "Réflexion en cours...";
    }

    return (
        <div className="chatbot-modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="chatbotTitle">
            <div className="chatbot-modal-content" onClick={e => e.stopPropagation()}>
                <div className="chatbot-modal-header">
                    <h3 id="chatbotTitle" className="chatbot-modal-title">
                        Assistant OtterCluster
                    </h3>
                    <button onClick={onClose} className="chatbot-close-button" aria-label="Fermer l'assistant">&times;</button>
                </div>
                <div className="chatbot-messages-container">
                    {messages.map(msg => (
                        <div key={msg.id} className={`chatbot-message chatbot-message-${msg.sender}`}>
                            <p className="chatbot-message-text">{msg.text}</p>
                            <span className="chatbot-message-timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                {chatbotError && <p className="chatbot-error-display" role="alert">{chatbotError}</p>}

                <div className="chatbot-input-area">
                    <div style={{width: '100%', display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <input
                            type="text"
                            className="chatbot-text-input"
                            placeholder="Posez votre question..."
                            value={textInputValue}
                            onChange={(e) => setTextInputValue(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendTextMessage()}
                            disabled={listeningState === 'processing'}
                            aria-label="Entrée de texte pour le chat"
                        />
                        <button
                            onClick={handleSendTextMessage}
                            className="chatbot-send-button submit-button"
                            disabled={listeningState === 'processing' || !textInputValue.trim()}
                            aria-label="Envoyer le message texte"
                        >
                            Envoyer
                        </button>
                    </div>
                    <p className="chatbot-status-text">
                        {statusText}
                    </p>
                </div>
            </div>
        </div>
    );
};
// --- End ChatbotModal Component ---


interface SidebarProps {
    currentPage: Page;
    navigateTo: (page: Page) => void;
    userRole: UserRole;
    userPlan: UserPlan;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, navigateTo }) => {
    const mainNavItems: NavItem[] = [
        { id: 'dashboard', label: 'Dashboard', href: '#' },
        { id: 'my-projects', label: 'My Projects', href: '#' },
        { id: 'search-intentions', label: 'Intentions de recherches', href: '#' },
        { id: 'e-commerce-redaction', label: 'Rédaction Fiche E-commerce', href: '#' },
        { id: 'competitive-analysis', label: 'Analyse Concurrentielle', href: '#' },
        { id: 'product-page-analysis', label: 'Analyse Fiche Produit', href: '#' },
        { id: 'cro-optimization', label: 'Optimisation CRO', href: '#' },
        { id: 'faq-generator', label: "Générer une FAQ", href: '#' },
        { id: 'summary-table-generator', label: "Générer un Tableau Récapitulatif", href: '#' },
    ];

    const accountNavItems: NavItem[] = [
        { id: 'my-account-profile', label: 'Mon Compte Profil', href: '#' },
        { id: 'billing', label: 'Billing', href: '#' },
        { id: 'settings', label: 'Settings', href: '#' }
    ];

    const helpNavItems: NavItem[] = [
        { id: 'summary', label: 'Résumé', href: '#' },
        { id: 'online-help', label: 'Aide en ligne', href: '#' },
        { id: 'roadmap-dev', label: 'Roadmap Dev', href: '#' },
        { id: 'specs-for-dev', label: 'Specs pour dev', href: '#' },
        { id: 'contact-support', label: 'Contact Support', href: '#' },
    ];


    const renderNavItems = useCallback((items: NavItem[]) => (
        <ul className="nav-list">
            {items.map(item => (
                <li key={item.id} className="nav-item">
                    <a
                        href={item.href}
                        className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
                        onClick={(e) => {
                            e.preventDefault();
                            if (item.id === 'contact-support') {
                                alert("Contact Support (Placeholder)");
                            } else {
                                navigateTo(item.id as Page);
                            }
                        }}
                        aria-current={currentPage === item.id ? 'page' : undefined}
                    >
                        {item.label}
                    </a>
                </li>
            ))}
        </ul>
    ), [currentPage, navigateTo]);

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <h1>OtterCluster</h1>
            </div>

            <nav>
                <div className="nav-section">
                    <h2 className="nav-section-title">Principal</h2>
                    {renderNavItems(mainNavItems)}
                </div>

                <div className="nav-section">
                    <h2 className="nav-section-title">Mon Compte</h2>
                     {renderNavItems(accountNavItems)}
                </div>

                <div className="nav-section">
                    <h2 className="nav-section-title">Aide & Ressources</h2>
                    {renderNavItems(helpNavItems)}
                </div>
            </nav>
        </aside>
    );
};

interface MainWrapperProps {
    currentPage: Page;
    navigateTo: (page: Page) => void;
    userRole: UserRole;
    userPlan: UserPlan;
    userProfile: UserProfileData | null;
    onProfileUpdate: (profile: UserProfileData) => void;
    onSignOut: () => void;
    userEmail: string;
    credits: { remaining: number; total: number; };
}

const MainWrapper: React.FC<MainWrapperProps> = (props) => {
    const { currentPage, navigateTo, userRole, userPlan, userProfile, onProfileUpdate, onSignOut, credits } = props;

    return (
        <div className="main-wrapper">
            <Header 
                currentPage={currentPage} 
                userRole={userRole} 
                userProfile={userProfile} 
                onSignOut={onSignOut} 
                navigateTo={navigateTo}
                creditsRemaining={credits.remaining}
                creditsTotal={credits.total}
            />
            <main className="main-content">
                {currentPage === 'dashboard' && <DashboardPage navigateTo={navigateTo} userProfile={userProfile} />}
                {currentPage === 'my-projects' && <MyProjectsPage />}
                {currentPage === 'search-intentions' && <SearchIntentionsPage navigateTo={navigateTo} />}
                {currentPage === 'e-commerce-redaction' && ai && <EcommerceRedactionPage ai={ai}/>}
                {currentPage === 'competitive-analysis' && ai && <CompetitiveAnalysisPage ai={ai} />}
                {currentPage === 'product-page-analysis' && ai && <ProductPageAnalysisPage ai={ai} />}
                {currentPage === 'cro-optimization' && ai && <CroOptimizationPage ai={ai} />}
                {currentPage === 'faq-generator' && ai && <FaqGeneratorPage ai={ai} />}
                {currentPage === 'summary-table-generator' && ai && <SummaryTableGeneratorPage ai={ai} />}
                {currentPage === 'settings' && userRole === 'main' && <SettingsPage />}
                {currentPage === 'my-account-profile' && userProfile && <MyAccountProfilePage userProfile={userProfile} onProfileUpdate={onProfileUpdate} />}
                {currentPage === 'billing' && <BillingPage navigateTo={navigateTo} />}
                {currentPage === 'plans-pricing' && <PlansPricingPage navigateTo={navigateTo} />}
                {currentPage === 'roadmap-dev' && <RoadmapDevPage />}
                {currentPage === 'summary' && <SummaryPage />}
                {currentPage === 'online-help' && <OnlineHelpPage />}
                {currentPage === 'specs-for-dev' && <SpecsForDevPage />}
            </main>
        </div>
    );
};

interface HeaderProps {
    currentPage: Page;
    userRole: UserRole;
    userProfile: UserProfileData | null;
    onSignOut: () => void;
    navigateTo: (page: Page) => void;
    creditsRemaining: number;
    creditsTotal: number;
}

const Header: React.FC<HeaderProps> = ({ currentPage, userRole, userProfile, onSignOut, navigateTo, creditsRemaining, creditsTotal }) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const getGreetingName = useCallback(() => {
        if (userProfile?.firstName) {
            return userProfile.firstName;
        }
        return userRole === 'main' ? 'Admin' : 'Collaborateur';
    }, [userProfile, userRole]);

    const getUserInitials = useCallback(() => {
        if (userProfile?.firstName && userProfile?.lastName) {
            return `${userProfile.firstName.charAt(0)}${userProfile.lastName.charAt(0)}`.toUpperCase();
        }
        if (userProfile?.firstName) {
            return userProfile.firstName.charAt(0).toUpperCase();
        }
        return getGreetingName().charAt(0).toUpperCase();
    }, [userProfile, getGreetingName]);

    const toggleDropdown = useCallback(() => setDropdownOpen(prev => !prev), []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const isLowOnCredits = creditsTotal > 0 && (creditsRemaining / creditsTotal) < 0.1;

    return (
        <header className="header">
            <div className="breadcrumbs">
                OtterCluster / <span className="current-page">{getPageTitle(currentPage)}</span>
            </div>
            <div className="header-right-section">
                <div 
                    className={`header-credits-display ${isLowOnCredits ? 'low-credits' : ''}`}
                    title={`Crédits restants ce mois-ci : ${creditsRemaining} / ${creditsTotal}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                    </svg>
                    <span>Crédits : <strong>{creditsRemaining}</strong></span>
                </div>
                <div className="user-profile-container" ref={dropdownRef}>
                    <div className="user-profile" onClick={toggleDropdown} role="button" tabIndex={0} aria-expanded={dropdownOpen} aria-haspopup="true" aria-controls="userProfileMenu">
                        <div className="user-avatar" aria-hidden="true">{getUserInitials()}</div>
                        <span className="user-name">Bonjour, {getGreetingName()}</span>
                    </div>
                    {dropdownOpen && (
                        <ul id="userProfileMenu" className="user-profile-dropdown" role="menu">
                            <li role="none"><button role="menuitem" className="user-menu-item" onClick={() => { navigateTo('my-account-profile'); setDropdownOpen(false); }}>Mon Profil</button></li>
                            <li role="none"><button role="menuitem" className="user-menu-item" onClick={() => { navigateTo('billing'); setDropdownOpen(false); }}>Facturation</button></li>
                            {userRole === 'main' && (
                               <li role="none"><button role="menuitem" className="user-menu-item" onClick={() => { navigateTo('plans-pricing'); setDropdownOpen(false);}}>Plans et Tarif</button></li>
                            )}
                            {userRole === 'main' && (
                                 <li role="none"><button role="menuitem" className="user-menu-item" onClick={() => { navigateTo('settings'); setDropdownOpen(false); }}>Paramètres</button></li>
                            )}
                            <li role="separator"><hr style={{margin: '5px 0', borderColor: '#eee'}} /></li>
                            <li role="none"><button role="menuitem" className="user-menu-item" onClick={onSignOut}>Déconnexion</button></li>
                        </ul>
                    )}
                </div>
            </div>
        </header>
    );
};


const DashboardPage: React.FC<{ navigateTo: (page: Page) => void; userProfile: UserProfileData | null; }> = ({ navigateTo, userProfile }) => {
    const [stats, setStats] = useState({ projects: 0 });
    const greetingName = userProfile?.firstName || 'Utilisateur';

    useEffect(() => {
        const projectsCount = loadFromLocalStorage<Project[]>(LOCAL_STORAGE_PROJECTS, []).length;
        setStats({ projects: projectsCount });
    }, []);

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <h2 className="content-title">Bonjour, {greetingName} !</h2>
                <p className="content-subtitle">Prêt à optimiser votre boutique en ligne aujourd'hui ?</p>
            </div>

            <div className="dashboard-grid">
                <div className="stat-card">
                    <div className="stat-card-icon projects-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                        </svg>
                    </div>
                    <div className="stat-card-content">
                        <p className="stat-card-metric">{stats.projects}</p>
                        <p className="stat-card-label">Projets Actifs</p>
                    </div>
                </div>

                <div className="content-card quick-actions-card">
                    <h3 className="card-title-small">Actions Rapides</h3>
                    <div className="quick-actions-buttons">
                        <button className="submit-button" onClick={() => navigateTo('e-commerce-redaction')}>Rédiger une Fiche Produit</button>
                        <button className="button-secondary" onClick={() => navigateTo('competitive-analysis')}>Analyser un Concurrent</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MyProjectsPage: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [projectUrl, setProjectUrl] = useState('');
    const [projectCms, setProjectCms] = useState<CMS | ''>('');
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [isFormDirty, setIsFormDirty] = useState(false);
    
    // FIX: Explicitly pass the generic type `Project` to `useSortableData` to ensure correct type inference for `requestSort`.
    const { items: sortedProjects, requestSort, sortConfig } = useSortableData<Project>(projects, { key: 'creationDate', direction: 'descending' });

    // Effect to track if the form in the modal has unsaved changes
    useEffect(() => {
        if (!editingProject) {
            setIsFormDirty(false);
            return;
        }
        const nameChanged = projectName !== editingProject.name;
        const urlChanged = projectUrl !== editingProject.url;
        const cmsChanged = projectCms !== (editingProject.cms || '');
        setIsFormDirty(nameChanged || urlChanged || cmsChanged);
    }, [projectName, projectUrl, projectCms, editingProject]);


    const getSortClassFor = (key: keyof Project) => {
        if (!sortConfig) {
            return '';
        }
        return sortConfig.key === key ? sortConfig.direction : '';
    };

    const cmsDisplayMap: Record<CMS, string> = {
        woocommerce: 'Woocommerce',
        shopify: 'Shopify',
        prestashop: 'Prestashop',
        bigcommerce: 'Big Commerce',
        other: 'Autre (Export CSV)',
    };

    useEffect(() => {
        setProjects(loadFromLocalStorage<Project[]>(LOCAL_STORAGE_PROJECTS, []));
    }, []);

    const saveProjects = useCallback((updatedProjects: Project[]) => {
        setProjects(updatedProjects);
        saveToLocalStorage(LOCAL_STORAGE_PROJECTS, updatedProjects);
    }, []);

    const handleOpenModal = useCallback((project: Project | null = null) => {
        if (project) {
            setEditingProject(project);
            setProjectName(project.name);
            setProjectUrl(project.url);
            setProjectCms(project.cms || '');
        } else {
            setEditingProject(null);
            setProjectName('');
            setProjectUrl('');
            setProjectCms('');
        }
        setIsFormDirty(false); // Reset dirty state on open
        setIsModalOpen(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        if (isFormDirty && !window.confirm("You have unsaved changes that will be lost. Are you sure you want to close?")) {
            return; // Abort close if form is dirty and user cancels confirmation
        }
        setIsModalOpen(false);
    }, [isFormDirty]);

    const handleSaveProject = useCallback(() => {
        if (!projectName.trim()) {
            alert("Le nom du projet est requis.");
            return;
        }

        if (editingProject) {
            const updatedProjects = projects.map(p =>
                p.id === editingProject.id ? { ...p, name: projectName, url: projectUrl, cms: projectCms ? (projectCms as CMS) : undefined } : p
            );
            saveProjects(updatedProjects);
        } else {
            const newProject: Project = {
                id: `proj_${Date.now()}`,
                name: projectName,
                url: projectUrl,
                cms: projectCms ? (projectCms as CMS) : undefined,
                creationDate: new Date().toISOString(),
                gscConnected: false,
                gaConnected: false,
            };
            saveProjects([...projects, newProject]);
        }
        setIsModalOpen(false); // Close modal directly, bypassing the dirty check
    }, [editingProject, projects, projectName, projectUrl, projectCms, saveProjects]);

    const handleDeleteProject = useCallback((projectId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.")) {
            const updatedProjects = projects.filter(p => p.id !== projectId);
            saveProjects(updatedProjects);
        }
    }, [projects, saveProjects]);

    const handleToggleConnection = useCallback((projectId: string, type: 'gsc' | 'ga') => {
        const updatedProjects = projects.map(p => {
            if (p.id === projectId) {
                if (type === 'gsc') {
                    return { ...p, gscConnected: !p.gscConnected };
                }
                if (type === 'ga') {
                    return { ...p, gaConnected: !p.gaConnected };
                }
            }
            return p;
        });
        saveProjects(updatedProjects);
    }, [projects, saveProjects]);

    return (
        <div>
            <div className="page-header-actions">
                 <div>
                    <h2 className="content-title">Mes Projets</h2>
                    <p className="content-subtitle">Gérez vos projets pour organiser vos fiches produits et analyses.</p>
                </div>
                <button className="submit-button" onClick={() => handleOpenModal()}>
                    Créer un Projet
                </button>
            </div>
            <div className="content-card">
                 {projects.length > 0 ? (
                    <div className="table-responsive">
                        <table className="projects-table">
                            <thead>
                                <tr>
                                    <th onClick={() => requestSort('name')} className={`sortable-header ${getSortClassFor('name')}`}>Nom du Projet</th>
                                    <th onClick={() => requestSort('url')} className={`sortable-header ${getSortClassFor('url')}`}>URL du Site</th>
                                    <th onClick={() => requestSort('cms')} className={`sortable-header ${getSortClassFor('cms')}`}>CMS</th>
                                    <th onClick={() => requestSort('creationDate')} className={`sortable-header ${getSortClassFor('creationDate')}`}>Date de Création</th>
                                    <th onClick={() => requestSort('gscConnected')} className={`sortable-header ${getSortClassFor('gscConnected')}`}>Search Console</th>
                                    <th onClick={() => requestSort('gaConnected')} className={`sortable-header ${getSortClassFor('gaConnected')}`}>Analytics</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedProjects.map(project => (
                                    <tr key={project.id}>
                                        <td>{project.name}</td>
                                        <td><a href={project.url} target="_blank" rel="noopener noreferrer">{project.url}</a></td>
                                        <td>{project.cms ? cmsDisplayMap[project.cms] : 'N/A'}</td>
                                        <td>{new Date(project.creationDate).toLocaleDateString()}</td>
                                        <td>
                                            {project.gscConnected ? (
                                                <span className="connection-status connected">
                                                    Connecté
                                                    <button onClick={() => handleToggleConnection(project.id, 'gsc')} className="button-link-disconnect">(Déconnecter)</button>
                                                </span>
                                            ) : (
                                                <button className="button-secondary connect-button" onClick={() => handleToggleConnection(project.id, 'gsc')}>Connecter</button>
                                            )}
                                        </td>
                                        <td>
                                            {project.gaConnected ? (
                                                <span className="connection-status connected">
                                                    Connecté
                                                    <button onClick={() => handleToggleConnection(project.id, 'ga')} className="button-link-disconnect">(Déconnecter)</button>
                                                </span>
                                            ) : (
                                                <button className="button-secondary connect-button" onClick={() => handleToggleConnection(project.id, 'ga')}>Connecter</button>
                                            )}
                                        </td>
                                        <td className="table-actions-cell">
                                            <button className="button-link" onClick={() => handleOpenModal(project)}>Modifier</button>
                                            <button className="button-link-delete" onClick={() => handleDeleteProject(project.id)}>Supprimer</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state-text">
                        <p>Aucun projet pour le moment.</p>
                        <button className="submit-button" style={{marginTop: '16px'}} onClick={() => handleOpenModal()}>Créer votre premier projet</button>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editingProject ? 'Modifier le Projet' : 'Créer un Nouveau Projet'}</h3>
                            <button className="close-modal-button" onClick={handleCloseModal}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label htmlFor="project-name" className="form-label">Nom du Projet</label>
                                <input id="project-name" type="text" className="form-input" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Ex: Blog de Recettes" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="project-url" className="form-label">URL du Site (Optionnel)</label>
                                <input id="project-url" type="text" className="form-input" value={projectUrl} onChange={e => setProjectUrl(e.target.value)} placeholder="Ex: https://www.monsite.com" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="project-cms" className="form-label">CMS (Optionnel)</label>
                                <select id="project-cms" className="form-select" value={projectCms} onChange={e => setProjectCms(e.target.value as (CMS | ''))}>
                                    <option value="">Sélectionner un CMS...</option>
                                    <option value="woocommerce">Woocommerce</option>
                                    <option value="shopify">Shopify</option>
                                    <option value="prestashop">Prestashop</option>
                                    <option value="bigcommerce">Big Commerce</option>
                                    <option value="other">Autre (Export CSV)</option>
                                </select>
                                <p className="form-helper-text">Sera utilisé pour l'intégration automatique des contenus.</p>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="button-secondary" onClick={handleCloseModal}>Annuler</button>
                            <button className="submit-button" onClick={handleSaveProject}>Sauvegarder</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SEARCH INTENTIONS PAGE ---
const SearchIntentionsPage: React.FC<{ navigateTo: (page: Page) => void }> = ({ navigateTo }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [currentProjectIntentions, setCurrentProjectIntentions] = useState<SearchIntention[]>([]);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    // FIX: Explicitly pass the generic type `SearchIntention` to `useSortableData` to ensure correct type inference for `requestSort` when the initial array is empty.
    const { items: sortedIntentions, requestSort, sortConfig } = useSortableData<SearchIntention>(currentProjectIntentions);

    useEffect(() => {
        setProjects(loadFromLocalStorage<Project[]>(LOCAL_STORAGE_PROJECTS, []));
    }, []);
    
    useEffect(() => {
        if (selectedProjectId) {
            const intentions = loadFromLocalStorage<SearchIntention[]>(`${LOCAL_STORAGE_SEARCH_INTENTIONS_PREFIX}${selectedProjectId}`, []);
            setCurrentProjectIntentions(intentions);
        } else {
            setCurrentProjectIntentions([]);
        }
    }, [selectedProjectId]);

    const selectedProject = projects.find(p => p.id === selectedProjectId);

    const getSortClassFor = (key: keyof SearchIntention) => {
        if (!sortConfig) return '';
        return sortConfig.key === key ? sortConfig.direction : '';
    };

    const parseCsv = (csvText: string): SearchIntention[] => {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
             setMessage({ text: "Le fichier CSV est vide ou ne contient pas d'en-têtes.", type: 'error' });
             return [];
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        const queryIndex = headers.findIndex(h => h.includes('query') || h.includes('keyword') || h.includes('requête'));

        if (queryIndex === -1) {
            setMessage({ text: "Le fichier CSV doit contenir une colonne nommée 'Query', 'Keyword' ou 'Requête'.", type: 'error' });
            return [];
        }

        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const intention: SearchIntention = { query: values[queryIndex] || '' };
            headers.forEach((header, index) => {
                if (index !== queryIndex) {
                    intention[header] = values[index] || '';
                }
            });
            return intention;
        }).filter(item => item.query);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !selectedProjectId) return;

        setMessage(null);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const parsedData = parseCsv(text);

                if (parsedData.length > 0) {
                    saveToLocalStorage(`${LOCAL_STORAGE_SEARCH_INTENTIONS_PREFIX}${selectedProjectId}`, parsedData);
                    setCurrentProjectIntentions(parsedData);
                    setMessage({ text: `${parsedData.length} intentions de recherche importées avec succès. Les données précédentes ont été remplacées.`, type: 'success' });
                }
            } catch (error: any) {
                setMessage({ text: `Erreur lors de la lecture du fichier: ${error.message}`, type: 'error' });
            }
        };
        reader.onerror = () => {
             setMessage({ text: 'Impossible de lire le fichier.', type: 'error' });
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset file input to allow re-upload of the same file
    };

    return (
        <div>
            <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Intentions de Recherches</h2>
                    <p className="content-subtitle">Importez et gérez les données d'intention de recherche pour vos projets.</p>
                </div>
            </div>

            <div className="content-card">
                <div className="form-group">
                    <label htmlFor="project-select-intentions" className="form-label">Sélectionnez un projet</label>
                    <select id="project-select-intentions" className="form-select" value={selectedProjectId} onChange={(e) => { setSelectedProjectId(e.target.value); setMessage(null); }}>
                        <option value="">Choisissez un projet...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>
            </div>

            {selectedProject && (
                <div className="content-card">
                    <h3 className="output-label">Importer des Données pour "{selectedProject.name}"</h3>
                    <p className="form-helper-text" style={{ marginBottom: '20px' }}>L'import d'un nouveau fichier CSV écrasera les données existantes pour ce projet.</p>
                    
                    <div className="import-sections-grid">
                        <div className="import-section">
                            <h4>Google Search Console</h4>
                            {selectedProject.gscConnected ? (
                                <div className="form-group">
                                    <label htmlFor="gsc-upload" className="form-label">Importer un export GSC (CSV)</label>
                                    <input type="file" id="gsc-upload" className="form-input" accept=".csv" onChange={handleFileChange} />
                                    <p className="form-helper-text">Exportez les "Requêtes" depuis votre GSC.</p>
                                </div>
                            ) : (
                                <div className="info-banner info-banner-warning">
                                    Google Search Console n'est pas connecté pour ce projet. <a href="#" onClick={(e) => { e.preventDefault(); navigateTo('my-projects'); }}>Connectez-le depuis la page "Mes Projets"</a>.
                                </div>
                            )}
                        </div>
                        <div className="import-section">
                            <h4>AnswerThePublic</h4>
                            <div className="form-group">
                                <label htmlFor="atp-upload" className="form-label">Importer un export AnswerThePublic (CSV)</label>
                                <input type="file" id="atp-upload" className="form-input" accept=".csv" onChange={handleFileChange} />
                                <p className="form-helper-text">Le fichier doit contenir une colonne "Keyword".</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {message && <div className={`message-banner ${message.type === 'success' ? 'success-message' : 'error-message'}`}>{message.text}</div>}

            {selectedProject && (
                <div className="content-card">
                    <h3 className="output-label">Intentions Actuelles ({currentProjectIntentions.length})</h3>
                    {currentProjectIntentions.length > 0 ? (
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th onClick={() => requestSort('query')} className={`sortable-header ${getSortClassFor('query')}`}>Requête</th>
                                        <th onClick={() => requestSort('clicks')} className={`sortable-header ${getSortClassFor('clicks')}`}>Clics</th>
                                        <th onClick={() => requestSort('impressions')} className={`sortable-header ${getSortClassFor('impressions')}`}>Impressions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedIntentions.map((item, index) => (
                                        <tr key={index}>
                                            <td>{item.query}</td>
                                            <td>{item.clicks || 'N/A'}</td>
                                            <td>{item.impressions || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="empty-state-text small">Aucune intention de recherche importée pour ce projet.</p>
                    )}
                </div>
            )}
        </div>
    );
};

// --- E-COMMERCE REDACTION PAGE ---
interface EcommerceRedactionPageProps {
    ai: GoogleGenAI;
}
interface GeneratedDescription {
    productUrl: string;
    description: string;
    jsonLd: string;
}
const EcommerceRedactionPage: React.FC<EcommerceRedactionPageProps> = ({ ai }) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [siteUrl, setSiteUrl] = useState('');
    const [targetCustomer, setTargetCustomer] = useState('');
    const [productUrlsInput, setProductUrlsInput] = useState('');
    const [siteAnalysis, setSiteAnalysis] = useState<{ mission: string; vision: string; valeurs: string; eeat: string; } | null>(null);
    const [generatedDescriptions, setGeneratedDescriptions] = useState<GeneratedDescription[]>([]);
    const [loadingSiteAnalysis, setLoadingSiteAnalysis] = useState(false);
    const [loadingDescriptions, setLoadingDescriptions] = useState(false);
    const [generationProgress, setGenerationProgress] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [projectIntentions, setProjectIntentions] = useState<SearchIntention[] | null>(null);
    const [openJsonLd, setOpenJsonLd] = useState<Record<number, boolean>>({});

    const toggleJsonLd = (index: number) => {
        setOpenJsonLd(prev => ({ ...prev, [index]: !prev[index] }));
    };

    // FIX: Explicitly pass the generic type `GeneratedDescription` to `useSortableData` to ensure correct type inference for `requestSort` when the initial array is empty.
    const { items: sortedDescriptions, requestSort, sortConfig } = useSortableData<GeneratedDescription>(generatedDescriptions);
    const getSortClassFor = (key: keyof GeneratedDescription) => {
        if (!sortConfig) {
            return '';
        }
        return sortConfig.key === key ? sortConfig.direction : '';
    };

    useEffect(() => {
        setProjects(loadFromLocalStorage<Project[]>(LOCAL_STORAGE_PROJECTS, []));
    }, []);

    useEffect(() => {
        if (selectedProjectId) {
            const intentions = loadFromLocalStorage<SearchIntention[]>(`${LOCAL_STORAGE_SEARCH_INTENTIONS_PREFIX}${selectedProjectId}`, []);
            setProjectIntentions(intentions.length > 0 ? intentions : null);
        } else {
            setProjectIntentions(null);
        }
    }, [selectedProjectId]);

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const autoIntegrationCMS: CMS[] = ['woocommerce', 'shopify', 'prestashop', 'bigcommerce'];
    const cmsDisplayMap: Record<CMS, string> = {
        woocommerce: 'Woocommerce',
        shopify: 'Shopify',
        prestashop: 'Prestashop',
        bigcommerce: 'Big Commerce',
        other: 'Autre (Export CSV)',
    };

    const handleAnalyzeSite = useCallback(async () => {
        if (!siteUrl.trim()) {
            setError("Veuillez entrer l'URL du site à analyser.");
            return;
        }
        try { new URL(siteUrl); } catch (_) {
            setError("Le format de l'URL est invalide.");
            return;
        }

        setLoadingSiteAnalysis(true);
        setError(null);
        setSiteAnalysis(null);

        try {
            const prompt = `Analyse le site web à l'URL suivante: ${siteUrl}. Extrais sa mission, sa vision, ses valeurs fondamentales, et une évaluation de son E.E.A.T. (Expertise, Authoritativeness, Trustworthiness). Formatte la réponse comme suit, avec chaque section sur une nouvelle ligne:
Mission: [Texte de la mission]
Vision: [Texte de la vision]
Valeurs: [Texte des valeurs]
EEAT: [Texte de l'évaluation EEAT]`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { tools: [{ googleSearch: {} }] },
            });
            
            const text = response.text;
            const missionMatch = text.match(/Mission:\s*([\s\S]*?)(?=\nVision:|\nValeurs:|\nEEAT:|$)/);
            const visionMatch = text.match(/Vision:\s*([\s\S]*?)(?=\nMission:|\nValeurs:|\nEEAT:|$)/);
            const valeursMatch = text.match(/Valeurs:\s*([\s\S]*?)(?=\nMission:|\nVision:|\nEEAT:|$)/);
            const eeatMatch = text.match(/EEAT:\s*([\s\S]*?)(?=\nMission:|\nVision:|\nValeurs:|$)/);

            const analysisResult = {
                mission: missionMatch ? missionMatch[1].trim() : "Non trouvée",
                vision: visionMatch ? visionMatch[1].trim() : "Non trouvée",
                valeurs: valeursMatch ? valeursMatch[1].trim() : "Non trouvées",
                eeat: eeatMatch ? eeatMatch[1].trim() : "Non évalué",
            };
            setSiteAnalysis(analysisResult);

        } catch (e: any) {
            setError(`L'analyse du site a échoué: ${e.message}`);
        } finally {
            setLoadingSiteAnalysis(false);
        }
    }, [ai.models, siteUrl]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                const urls = text.split(/[\r\n]+/).map(line => line.split(',')[0].trim()).filter(Boolean);
                setProductUrlsInput(urls.join('\n'));
            };
            reader.readAsText(file);
        }
    }, []);
    
    const productUrls = productUrlsInput.split('\n').map(url => url.trim()).filter(url => url.length > 0 && url.startsWith('http')).slice(0, 20);
    const creditCost = productUrls.length * 10;

    const handleGenerateDescriptions = useCallback(async () => {
        if (!siteAnalysis || productUrls.length === 0) {
            setError("Veuillez d'abord analyser un site et fournir au moins une URL de produit.");
            return;
        }

        setLoadingDescriptions(true);
        setError(null);
        setGeneratedDescriptions([]);
        
        const results: GeneratedDescription[] = [];
        const intentionsText = projectIntentions && projectIntentions.length > 0
            ? `Prends également en compte les intentions de recherche suivantes pour optimiser le contenu (mots-clés, questions) : ${projectIntentions.map(i => i.query).slice(0, 50).join(', ')}.`
            : '';

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                descriptionHtml: { type: Type.STRING, description: "La description du produit au format HTML." },
                jsonLd: { type: Type.STRING, description: "Le script JSON-LD complet pour le produit." }
            },
            required: ["descriptionHtml", "jsonLd"]
        };


        for (let i = 0; i < productUrls.length; i++) {
            const url = productUrls[i];
            setGenerationProgress(`Génération de la fiche ${i + 1}/${productUrls.length} pour : ${url}`);
            try {
                const prompt = `En te basant sur les informations suivantes sur une entreprise :\n- Mission: ${siteAnalysis.mission}\n- Vision: ${siteAnalysis.vision}\n- Valeurs: ${siteAnalysis.valeurs}\n- E.E.A.T: ${siteAnalysis.eeat}\n- Cible client: ${targetCustomer || 'non spécifiée'}\n\n${intentionsText}\n\nAnalyse la page produit à l'URL : ${url}. Extrais les informations essentielles (nom, images, description, marque, prix, devise, disponibilité, etc.).\nEnsuite, effectue deux tâches :\n1. Rédige une fiche produit optimisée SEO en HTML (avec <p>, <ul>, <li>).\n2. Crée un script JSON-LD valide pour un 'Product' rich result, incluant autant de propriétés pertinentes que possible (name, image, description, brand, offers, aggregateRating, etc.). Si une information n'est pas disponible, omets la propriété.\n\nRetourne un objet JSON valide.`;
                
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { 
                        tools: [{ googleSearch: {} }],
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                    },
                });

                const parsedResponse = extractJsonFromResponse(response.text);
                results.push({ productUrl: url, description: parsedResponse.descriptionHtml, jsonLd: parsedResponse.jsonLd });
                setGeneratedDescriptions([...results]);

            } catch (e: any) {
                results.push({ productUrl: url, description: `Erreur de génération: ${e.message}`, jsonLd: `{ "error": "${e.message}" }` });
                setGeneratedDescriptions([...results]);
            }
        }
        
        setGenerationProgress('');
        setLoadingDescriptions(false);
    }, [ai.models, siteAnalysis, productUrls, targetCustomer, projectIntentions]);

    const handleExport = useCallback((format: 'csv' | 'shopify' | 'prestashop' | 'woocommerce') => {
        if (generatedDescriptions.length === 0) return;

        const escapeCsv = (field: string) => `"${(field || '').replace(/"/g, '""')}"`;
        let csvContent = "";
        let fileName = "export.csv";
        let headers: string[];

        const dataRows = generatedDescriptions.map(item => {
            return [escapeCsv(item.productUrl), escapeCsv(item.description), escapeCsv(item.jsonLd)];
        });

        switch (format) {
            case 'shopify':
                fileName = "shopify_import.csv";
                headers = ["Product URL", "Body (HTML)", "JSON-LD Script"];
                break;
            case 'woocommerce':
                fileName = "woocommerce_import.csv";
                headers = ["Product URL", "Description", "JSON-LD Script"];
                break;
            case 'prestashop':
                fileName = "prestashop_import.csv";
                headers = ["Product URL", "Description", "JSON-LD Script"];
                break;
            default:
                fileName = "fiches_produits.csv";
                headers = ["Product URL", "Description", "JSON-LD Script"];
                break;
        }

        csvContent = headers.join(',') + '\r\n';
        dataRows.forEach(row => {
            csvContent += row.join(',') + '\r\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [generatedDescriptions]);


    const isGenerationDisabled = loadingDescriptions || loadingSiteAnalysis || !siteAnalysis || productUrls.length === 0;

    return (
        <div className="ecommerce-page-grid">
            <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Rédaction de Fiches Produit E-commerce</h2>
                    <p className="content-subtitle">Générez des descriptions produits engageantes et alignées avec votre marque.</p>
                </div>
            </div>

            <div className="content-card">
                <h3 className="output-label">Étape 1 : Analyser votre site</h3>
                <div className="form-group">
                    <label htmlFor="project-select-ecom" className="form-label">Associer à un projet (Optionnel)</label>
                     <select id="project-select-ecom" className="form-select" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} disabled={loadingSiteAnalysis || loadingDescriptions}>
                        <option value="">Sélectionner un projet...</option>
                        {projects.map(project => (
                            <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                    </select>
                    {selectedProject && (
                        <>
                            {selectedProject.cms && autoIntegrationCMS.includes(selectedProject.cms) ? (
                                <div className="info-banner info-banner-success" role="status">
                                    Intégration automatique disponible pour le CMS : <strong>{cmsDisplayMap[selectedProject.cms]}</strong>.
                                </div>
                            ) : (
                                <div className="info-banner info-banner-warning" role="status">
                                    Le CMS de ce projet n'est pas configuré pour l'intégration automatique. Un export CSV sera nécessaire.
                                </div>
                            )}
                        </>
                    )}
                     {projectIntentions && projectIntentions.length > 0 && (
                        <div className="info-banner info-banner-success" role="status">
                            ✅ {projectIntentions.length} intentions de recherche pour ce projet seront utilisées pour enrichir la rédaction.
                        </div>
                    )}
                </div>
                <div className="form-group">
                    <label htmlFor="site-url" className="form-label">URL de la page d'accueil de votre site</label>
                    <div className="input-with-button">
                        <input id="site-url" type="url" className="form-input" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://www.votresite.com" disabled={loadingSiteAnalysis || loadingDescriptions} />
                        <button onClick={handleAnalyzeSite} className="button-secondary" disabled={loadingSiteAnalysis || loadingDescriptions}>
                             {loadingSiteAnalysis ? <><span className="spinner"></span> Analyse...</> : "Analyser le site"}
                        </button>
                    </div>
                </div>
                {siteAnalysis && (
                    <div className="site-analysis-results">
                        <h3 className="output-label">Résultats de l'analyse</h3>
                        <div className="analysis-grid">
                            <div className="analysis-item"><h4>Mission</h4><p>{siteAnalysis.mission}</p></div>
                            <div className="analysis-item"><h4>Vision</h4><p>{siteAnalysis.vision}</p></div>
                            <div className="analysis-item"><h4>Valeurs</h4><p>{siteAnalysis.valeurs}</p></div>
                            <div className="analysis-item"><h4>E.E.A.T</h4><p>{siteAnalysis.eeat}</p></div>
                        </div>
                    </div>
                )}
            </div>

            <div className="content-card">
                 <h3 className="output-label">Étape 2 : Définir la cible et les produits</h3>
                 <div className="form-group">
                    <label htmlFor="target-customer" className="form-label">Cible client (Optionnel)</label>
                    <textarea id="target-customer" className="form-textarea" value={targetCustomer} onChange={(e) => setTargetCustomer(e.target.value)} placeholder="Décrivez votre client idéal : âge, centres d'intérêt, besoins..." disabled={loadingSiteAnalysis || loadingDescriptions}></textarea>
                 </div>
                 <div className="form-group urls-input-container">
                    <label htmlFor="product-urls" className="form-label">URLs des fiches produits (1 par ligne, max 20)</label>
                    <textarea id="product-urls" className="form-textarea" value={productUrlsInput} onChange={(e) => setProductUrlsInput(e.target.value)} placeholder="https://www.votresite.com/produit-1&#10;https://www.votresite.com/produit-2" disabled={loadingSiteAnalysis || loadingDescriptions}></textarea>
                    <label htmlFor="csv-upload" className="button-secondary" style={{marginTop: '10px', display: 'inline-block'}}>
                        <span>Ou charger un fichier CSV</span>
                        <input type="file" id="csv-upload" accept=".csv" onChange={handleFileChange} style={{display: 'none'}} />
                    </label>
                 </div>

                 <button className="submit-button" onClick={handleGenerateDescriptions} disabled={isGenerationDisabled}>
                    {loadingDescriptions ? <><span className="spinner"></span> Génération en cours...</> : `Générer les ${productUrls.length} fiches`}
                </button>
                 <p className="credit-cost-text">Coût total estimé : {creditCost} crédits</p>
                 {loadingDescriptions && <p className="generation-progress">{generationProgress}</p>}
            </div>

            {error && <div className="error-message" role="alert">{error}</div>}

            {generatedDescriptions.length > 0 && (
                 <div className="content-card">
                    <h3 className="output-label">Résultats de la Génération</h3>
                    <div className="export-buttons">
                        <button className="button-secondary" onClick={() => handleExport('csv')}>Exporter en CSV</button>
                        <button className="button-secondary" onClick={() => handleExport('shopify')}>Exporter pour Shopify</button>
                        <button className="button-secondary" onClick={() => handleExport('prestashop')}>Exporter pour PrestaShop</button>
                        <button className="button-secondary" onClick={() => handleExport('woocommerce')}>Exporter pour WooCommerce</button>
                    </div>
                    <div className="table-responsive">
                        <table className="data-table ecommerce-results-table">
                            <thead>
                                <tr>
                                    <th onClick={() => requestSort('productUrl')} className={`sortable-header ${getSortClassFor('productUrl')}`}>URL du Produit</th>
                                    <th onClick={() => requestSort('description')} className={`sortable-header ${getSortClassFor('description')}`}>Description Générée (HTML)</th>
                                    <th>JSON-LD</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedDescriptions.map((item, index) => (
                                    <React.Fragment key={index}>
                                        <tr>
                                            <td><a href={item.productUrl} target="_blank" rel="noopener noreferrer">{item.productUrl}</a></td>
                                            <td dangerouslySetInnerHTML={{ __html: item.description }}></td>
                                            <td>
                                                <button onClick={() => toggleJsonLd(index)} className="button-secondary" style={{padding: '6px 12px'}}>
                                                    {openJsonLd[index] ? 'Cacher' : 'Voir'}
                                                </button>
                                            </td>
                                        </tr>
                                        {openJsonLd[index] && (
                                            <tr className="json-ld-row">
                                                <td colSpan={3}>
                                                    <div className="code-block-container">
                                                        <pre className="code-block"><code>{item.jsonLd}</code></pre>
                                                        <button onClick={(e) => handleCopy(item.jsonLd, e)} className="copy-code-button">Copier</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- COMPETITIVE ANALYSIS PAGE ---
interface CompetitiveAnalysisPageProps {
    ai: GoogleGenAI;
}

interface SavedAnalysis {
    id: string;
    name: string;
    date: string;
    urls: string[];
    results: any;
}
const LOCAL_STORAGE_COMPETITIVE_ANALYSES = 'competitiveAnalyses_v2';

const CompetitorAnalysisDetail: React.FC<{ data: any }> = ({ data }) => (
    <div className="analysis-results-grid">
        <div className="analysis-result-card">
            <h3 className="card-title-small">Positionnement Marketing</h3>
            <p>{data.positioning}</p>
        </div>
        <div className="analysis-result-card">
            <h3 className="card-title-small">Profondeur du Catalogue</h3>
            <p>{data.catalogDepth}</p>
        </div>
        <div className="analysis-result-card">
            <h3 className="card-title-small">Meilleures Ventes Estimées</h3>
            <ul>
                {data.bestSellers?.map((item: any, index: number) => (
                    <li key={index}><strong>{item.name}:</strong> {item.reason}</li>
                ))}
            </ul>
        </div>
        <div className="analysis-result-card">
            <h3 className="card-title-small">Structure de la Fiche Produit</h3>
            <h4>Avantages (Bonnes pratiques)</h4>
            <ul>
                {data.productPageStructure?.advantages?.map((item: string, index: number) => <li key={index} className="strength">{item}</li>)}
            </ul>
            <h4>Inconvénients (Axes d'amélioration)</h4>
            <ul>
                {data.productPageStructure?.disadvantages?.map((item: string, index: number) => <li key={index} className="weakness">{item}</li>)}
            </ul>
        </div>
    </div>
);


const CompetitiveAnalysisPage: React.FC<CompetitiveAnalysisPageProps> = ({ ai }) => {
    const [competitorUrls, setCompetitorUrls] = useState<string[]>(['']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<any | null>(null);
    const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [analysisNameToSave, setAnalysisNameToSave] = useState('');
    const [activeTab, setActiveTab] = useState<string>('synthesis');

    useEffect(() => {
        setSavedAnalyses(loadFromLocalStorage<SavedAnalysis[]>(LOCAL_STORAGE_COMPETITIVE_ANALYSES, []));
    }, []);

    const handleUrlChange = useCallback((index: number, value: string) => {
        const newUrls = [...competitorUrls];
        newUrls[index] = value;
        setCompetitorUrls(newUrls);
    }, [competitorUrls]);

    const addUrlInput = useCallback(() => {
        if (competitorUrls.length < 4) {
            setCompetitorUrls([...competitorUrls, '']);
        }
    }, [competitorUrls]);

    const removeUrlInput = useCallback((index: number) => {
        if (competitorUrls.length > 1) {
            const newUrls = competitorUrls.filter((_, i) => i !== index);
            setCompetitorUrls(newUrls);
        }
    }, [competitorUrls]);

    const urlsToAnalyze = competitorUrls.filter(url => url.trim() !== '' && (url.startsWith('http://') || url.startsWith('https://')));
    const creditCost = urlsToAnalyze.length * 50;
    const isAnalysisDisabled = loading || urlsToAnalyze.length === 0;

    const handleAnalysis = useCallback(async () => {
        if (urlsToAnalyze.length === 0) {
            setError("Veuillez entrer au moins une URL de concurrent valide (commençant par http:// ou https://).");
            return;
        }

        setLoading(true);
        setError(null);
        setResults(null);
        setActiveTab('synthesis');

        try {
            const prompt = `
                En tant qu'expert en stratégie e-commerce, analyse les sites concurrents aux URLs suivantes : ${urlsToAnalyze.join(', ')}.
                Pour chaque site, fournis une analyse détaillée sur :
                1. Positionnement: Cible client, arguments de vente uniques, image de marque.
                2. Profondeur du Catalogue: Estimation du nombre de catégories et de produits, étendue de l'offre.
                3. Meilleures Ventes: Identification des produits mis en avant et pourquoi ils semblent être des best-sellers.
                4. Structure de la Fiche Produit: Analyse approfondie de la structure d'une fiche produit type. Identifie ses avantages et ses inconvénients en te basant sur les bonnes pratiques du e-commerce (qualité des images, clarté des descriptions, efficacité du CTA, présence d'avis clients, éléments de réassurance, etc.).

                Ensuite, fournis une Synthèse Stratégique Comparative qui met en lumière :
                - Les forces et faiblesses communes.
                - Les stratégies de différenciation de chaque concurrent.
                - Les opportunités de marché à saisir.

                Ta réponse DOIT être un objet JSON valide et rien d'autre, sans démarqueurs de code markdown comme \`\`\`json. La structure doit être :
                {
                  "synthesis": {
                    "commonStrengths": "Analyse des points forts que les concurrents partagent.",
                    "differentiationStrategies": "Analyse de ce qui rend chaque concurrent unique.",
                    "marketOpportunities": "Recommandations d'opportunités basées sur l'analyse."
                  },
                  "competitors": [
                    {
                      "url": "${urlsToAnalyze[0]}",
                      "analysis": {
                        "positioning": "Analyse du positionnement...",
                        "catalogDepth": "Analyse de la profondeur...",
                        "bestSellers": [{ "name": "Produit 1", "reason": "Raison..." }],
                        "productPageStructure": {
                          "advantages": ["Avantage 1 basé sur les bonnes pratiques...", "Avantage 2..."],
                          "disadvantages": ["Inconvénient 1 par rapport aux bonnes pratiques...", "Inconvénient 2..."]
                        }
                      }
                    }
                  ]
                }
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { tools: [{ googleSearch: {} }] },
            });
            
            const parsedJson = extractJsonFromResponse(response.text);
            setResults(parsedJson);

        } catch (e: any) {
            setError(`Une erreur est survenue lors de l'analyse. L'IA a peut-être eu du mal à structurer sa réponse. Veuillez réessayer. Détails: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, [ai.models, competitorUrls, urlsToAnalyze]);
    
    const openSaveModal = useCallback(() => {
        const defaultName = `Analyse - ${new Date().toLocaleDateString('fr-FR')}`;
        setAnalysisNameToSave(defaultName);
        setIsSaveModalOpen(true);
    }, []);

    const confirmSaveAnalysis = useCallback(() => {
        if (!analysisNameToSave.trim() || !results) return;
        
        const newSavedAnalysis: SavedAnalysis = {
            id: `analysis_${Date.now()}`,
            name: analysisNameToSave,
            date: new Date().toISOString(),
            urls: competitorUrls.filter(url => url.trim() !== ''),
            results: results,
        };

        const updatedAnalyses = [...savedAnalyses, newSavedAnalysis];
        setSavedAnalyses(updatedAnalyses);
        saveToLocalStorage(LOCAL_STORAGE_COMPETITIVE_ANALYSES, updatedAnalyses);
        
        setIsSaveModalOpen(false);
        setAnalysisNameToSave('');
    }, [analysisNameToSave, competitorUrls, results, savedAnalyses]);

    const viewSavedAnalysis = useCallback((analysis: SavedAnalysis) => {
        setResults(analysis.results);
        setCompetitorUrls(analysis.urls.length > 0 ? analysis.urls : ['']);
        setActiveTab('synthesis');
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.scrollTop = 0;
    }, []);

    const deleteSavedAnalysis = useCallback((analysisId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer cette analyse sauvegardée ?")) {
            const updatedAnalyses = savedAnalyses.filter(a => a.id !== analysisId);
            setSavedAnalyses(updatedAnalyses);
            saveToLocalStorage(LOCAL_STORAGE_COMPETITIVE_ANALYSES, updatedAnalyses);
        }
    }, [savedAnalyses]);

    return (
        <div className="page-with-sticky-footer">
            <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Analyse Concurrentielle E-commerce</h2>
                    <p className="content-subtitle">Analysez jusqu'à 4 concurrents pour obtenir une synthèse stratégique.</p>
                </div>
            </div>

            <div className="content-card">
                <div className="form-group">
                    <label className="form-label">URLs des concurrents (4 maximum)</label>
                    <div className="multi-url-inputs">
                        {competitorUrls.map((url, index) => (
                            <div key={index} className="input-with-button">
                                <input
                                    type="url"
                                    className="form-input"
                                    value={url}
                                    onChange={(e) => handleUrlChange(index, e.target.value)}
                                    placeholder={`https://www.concurrent-${index + 1}.com`}
                                    disabled={loading}
                                />
                                {competitorUrls.length > 1 && (
                                    <button onClick={() => removeUrlInput(index)} className="button-secondary remove-url-btn" aria-label="Supprimer l'URL">&times;</button>
                                )}
                            </div>
                        ))}
                    </div>
                    {competitorUrls.length < 4 && (
                        <button onClick={addUrlInput} className="button-link" style={{ marginTop: '12px', paddingLeft: 0 }}>+ Ajouter une URL</button>
                    )}
                </div>
            </div>
            
            <div className="content-card">
                 <h3 className="output-label">Analyses Sauvegardées</h3>
                 {savedAnalyses.length > 0 ? (
                    <ul className="saved-analyses-list">
                        {savedAnalyses.map(analysis => (
                            <li key={analysis.id} className="saved-analysis-item">
                                <div className="saved-analysis-info">
                                    <strong>{analysis.name}</strong>
                                    <span>({new Date(analysis.date).toLocaleDateString()}) - {analysis.urls.length} URL(s)</span>
                                </div>
                                <div className="saved-analysis-actions">
                                    <button className="button-secondary" onClick={() => viewSavedAnalysis(analysis)}>Voir</button>
                                    <button className="button-link-delete" onClick={() => deleteSavedAnalysis(analysis.id)}>Supprimer</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                 ) : (
                    <p className="empty-state-text small">Aucune analyse sauvegardée pour le moment.</p>
                 )}
            </div>

            {error && <div className="error-message" role="alert">{error}</div>}

            {loading && (
                <div className="content-card loader-container" style={{ textAlign: 'center', marginTop: '24px' }}>
                    <div className="spinner" style={{ width: '3rem', height: '3rem', borderWidth: '4px', margin: '0 auto 16px', borderTopColor: 'var(--primary-blue)' }}></div>
                    <p className="content-subtitle">Analyse des sites concurrents... Ce processus peut prendre une à deux minutes.</p>
                </div>
            )}
            
            {results && (
                <div className="content-card" style={{marginTop: "24px"}}>
                    <div className="results-header">
                        <h3 className="output-label" style={{border: 'none', padding: 0, margin: 0}}>Résultats de l'Analyse</h3>
                        <button className="submit-button" onClick={openSaveModal}>Sauvegarder l'Analyse</button>
                    </div>
                    
                    <div className="analysis-tabs">
                        <button className={`tab-button ${activeTab === 'synthesis' ? 'active' : ''}`} onClick={() => setActiveTab('synthesis')}>
                            Synthèse Stratégique
                        </button>
                        {results.competitors?.map((comp: any, index: number) => (
                             <button key={index} className={`tab-button ${activeTab === comp.url ? 'active' : ''}`} onClick={() => setActiveTab(comp.url)}>
                                Concurrent {index + 1}
                            </button>
                        ))}
                    </div>

                    <div className="analysis-tab-content">
                        {activeTab === 'synthesis' && results.synthesis && (
                            <div className="synthesis-grid">
                                <div className="analysis-result-card">
                                    <h3 className="card-title-small">Forces et Faiblesses Communes</h3>
                                    <p>{results.synthesis.commonStrengths}</p>
                                </div>
                                <div className="analysis-result-card">
                                    <h3 className="card-title-small">Stratégies de Différenciation</h3>
                                    <p>{results.synthesis.differentiationStrategies}</p>
                                </div>
                                <div className="analysis-result-card">
                                    <h3 className="card-title-small">Opportunités de Marché</h3>
                                    <p>{results.synthesis.marketOpportunities}</p>
                                </div>
                            </div>
                        )}
                        {results.competitors?.map((comp: any, index: number) => (
                            activeTab === comp.url && <CompetitorAnalysisDetail key={index} data={comp.analysis} />
                        ))}
                    </div>
                </div>
            )}

            {isSaveModalOpen && (
                 <div className="modal-overlay" onClick={() => setIsSaveModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Sauvegarder l'Analyse</h3>
                            <button className="close-modal-button" onClick={() => setIsSaveModalOpen(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label htmlFor="analysis-name" className="form-label">Nom de l'analyse</label>
                                <input id="analysis-name" type="text" className="form-input" value={analysisNameToSave} onChange={e => setAnalysisNameToSave(e.target.value)} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="button-secondary" onClick={() => setIsSaveModalOpen(false)}>Annuler</button>
                            <button className="submit-button" onClick={confirmSaveAnalysis}>Sauvegarder</button>
                        </div>
                    </div>
                </div>
            )}
            <StickyFooter
                creditCost={creditCost}
                buttonText="Lancer l'Analyse"
                onButtonClick={handleAnalysis}
                isButtonDisabled={isAnalysisDisabled}
                buttonLoadingText="Analyse en cours..."
            />
        </div>
    );
};

// --- PRODUCT PAGE ANALYSIS PAGE ---
interface ProductPageAnalysisPageProps {
    ai: GoogleGenAI;
}

const ProductPageAnalysisPage: React.FC<ProductPageAnalysisPageProps> = ({ ai }) => {
    const [productUrl, setProductUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<any | null>(null);
    const [editableMetaTitle, setEditableMetaTitle] = useState('');

    useEffect(() => {
        if (results?.optimizationSuggestions?.metaTitle?.suggested) {
            setEditableMetaTitle(results.optimizationSuggestions.metaTitle.suggested);
        } else {
            setEditableMetaTitle('');
        }
    }, [results]);

    const handleAnalysis = useCallback(async () => {
        if (!productUrl.trim() || !productUrl.startsWith('http')) {
            setError("Veuillez entrer une URL de fiche produit valide.");
            return;
        }
        setLoading(true);
        setError(null);
        setResults(null);

        try {
            const prompt = `
                En tant qu'expert en e-commerce, SEO et UX, analyse en profondeur la fiche produit à l'URL suivante : ${productUrl}.
                Base ton évaluation sur les meilleures pratiques de l'industrie, en t'inspirant notamment des recommandations de Google (https://developers.google.com/search/docs/specialty/ecommerce?hl=fr) et de Microsoft Bing.

                Ta réponse DOIT être un objet JSON valide et rien d'autre, sans démarqueurs de code markdown comme \`\`\`json. La structure doit être :
                {
                  "analysis": {
                    "pageStructure": { "strengths": ["..."], "weaknesses": ["..."] },
                    "designUI": { "strengths": ["..."], "weaknesses": ["..."] },
                    "content": {
                        "wordCount": "Environ X mots",
                        "densityAndNature": "Analyse de la densité sémantique...",
                        "strengths": ["..."],
                        "weaknesses": ["..."]
                    },
                    "seo": {
                      "strengths": ["Point fort SEO (ex: 'Bonne utilisation des données structurées Product')..."],
                      "weaknesses": ["Point faible SEO (ex: 'Aucun identifiant GTIN trouvé')..."]
                    },
                    "internalLinking": { "strengths": ["..."], "weaknesses": ["..."] },
                    "cro": { "strengths": ["..."], "weaknesses": ["..."] }
                  },
                  "summary": { "advantages": ["..."], "disadvantages": ["..."] },
                  "optimizationSuggestions": {
                    "metaTitle": {
                      "current": "Le titre meta actuel.",
                      "suggested": "Une suggestion de titre meta optimisé (environ 60 caractères).",
                      "reasoning": "Explication des améliorations."
                    },
                    "metaDescription": {
                      "current": "La meta description actuelle.",
                      "suggested": "Une suggestion de meta description optimisée (environ 155 caractères).",
                      "reasoning": "Explication des améliorations."
                    }
                  }
                }
            `;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { tools: [{ googleSearch: {} }] },
            });

            const parsedJson = extractJsonFromResponse(response.text);
            setResults(parsedJson);

        } catch (e: any) {
            setError(`Une erreur est survenue lors de l'analyse. L'IA a peut-être eu du mal à structurer sa réponse. Veuillez réessayer. Détails: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, [ai.models, productUrl]);

    return (
        <div className="page-with-sticky-footer">
            <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Analyse de Fiche Produit Concurrent</h2>
                    <p className="content-subtitle">Auditez une fiche produit spécifique pour identifier ses forces et faiblesses.</p>
                </div>
            </div>
            <div className="content-card">
                <div className="form-group">
                    <label htmlFor="product-url-analysis" className="form-label">URL de la fiche produit concurrente</label>
                    <input
                        id="product-url-analysis"
                        type="url"
                        className="form-input"
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        placeholder="https://www.site-concurrent.com/produit-exemple"
                        disabled={loading}
                    />
                </div>
            </div>

            {error && <div className="error-message" role="alert">{error}</div>}
            
            {loading && (
                <div className="content-card loader-container" style={{ textAlign: 'center', marginTop: '24px' }}>
                    <div className="spinner" style={{ width: '3rem', height: '3rem', borderWidth: '4px', margin: '0 auto 16px', borderTopColor: 'var(--primary-blue)' }}></div>
                    <p className="content-subtitle">Analyse de la fiche produit... Ce processus peut prendre un moment.</p>
                </div>
            )}

            {results && (
                <div className="content-card" style={{marginTop: "24px"}}>
                    <h3 className="output-label">Résultats de l'Analyse</h3>
                    <div className="product-analysis-grid">
                        <div className="analysis-result-card">
                            <h3 className="card-title-small">Structure de la Page</h3>
                            <h4>Points Forts</h4>
                            <ul>{results.analysis?.pageStructure?.strengths?.map((item: string, i: number) => <li key={i} className="strength">{item}</li>)}</ul>
                            <h4>Points Faibles</h4>
                            <ul>{results.analysis?.pageStructure?.weaknesses?.map((item: string, i: number) => <li key={i} className="weakness">{item}</li>)}</ul>
                        </div>
                        <div className="analysis-result-card">
                            <h3 className="card-title-small">Design & UI</h3>
                            <h4>Points Forts</h4>
                            <ul>{results.analysis?.designUI?.strengths?.map((item: string, i: number) => <li key={i} className="strength">{item}</li>)}</ul>
                            <h4>Points Faibles</h4>
                            <ul>{results.analysis?.designUI?.weaknesses?.map((item: string, i: number) => <li key={i} className="weakness">{item}</li>)}</ul>
                        </div>
                        <div className="analysis-result-card">
                            <h3 className="card-title-small">Analyse du Contenu</h3>
                            <div className="content-analysis-details">
                                <p><strong>Nombre de mots :</strong> {results.analysis?.content?.wordCount}</p>
                                <p><strong>Densité & Nature :</strong> {results.analysis?.content?.densityAndNature}</p>
                            </div>
                            <h4>Points Forts</h4>
                            <ul>{results.analysis?.content?.strengths?.map((item: string, i: number) => <li key={i} className="strength">{item}</li>)}</ul>
                            <h4>Points Faibles</h4>
                            <ul>{results.analysis?.content?.weaknesses?.map((item: string, i: number) => <li key={i} className="weakness">{item}</li>)}</ul>
                        </div>
                        <div className="analysis-result-card">
                            <h3 className="card-title-small">Analyse SEO & Référencement</h3>
                            <h4>Points Forts</h4>
                            <ul>{results.analysis?.seo?.strengths?.map((item: string, i: number) => <li key={i} className="strength">{item}</li>)}</ul>
                            <h4>Points Faibles</h4>
                            <ul>{results.analysis?.seo?.weaknesses?.map((item: string, i: number) => <li key={i} className="weakness">{item}</li>)}</ul>
                        </div>
                         <div className="analysis-result-card">
                            <h3 className="card-title-small">Maillage Interne</h3>
                            <h4>Points Forts</h4>
                            <ul>{results.analysis?.internalLinking?.strengths?.map((item: string, i: number) => <li key={i} className="strength">{item}</li>)}</ul>
                            <h4>Points Faibles</h4>
                            <ul>{results.analysis?.internalLinking?.weaknesses?.map((item: string, i: number) => <li key={i} className="weakness">{item}</li>)}</ul>
                        </div>
                         <div className="analysis-result-card">
                            <h3 className="card-title-small">Optimisation de la Conversion (CRO)</h3>
                            <h4>Points Forts</h4>
                            <ul>{results.analysis?.cro?.strengths?.map((item: string, i: number) => <li key={i} className="strength">{item}</li>)}</ul>
                            <h4>Points Faibles</h4>
                            <ul>{results.analysis?.cro?.weaknesses?.map((item: string, i: number) => <li key={i} className="weakness">{item}</li>)}</ul>
                        </div>
                         <div className="analysis-result-card">
                            <h3 className="card-title-small">Synthèse</h3>
                             <h4>Avantages Clés</h4>
                            <ul>{results.summary?.advantages?.map((item: string, i: number) => <li key={i} className="strength">{item}</li>)}</ul>
                            <h4>Inconvénients Majeurs</h4>
                            <ul>{results.summary?.disadvantages?.map((item: string, i: number) => <li key={i} className="weakness">{item}</li>)}</ul>
                        </div>
                    </div>

                    {results.optimizationSuggestions && (
                        <div className="meta-suggestions-section">
                            <h3 className="card-title-small" style={{borderBottom: 'none', marginBottom: '24px'}}>Suggestions d'Optimisation Meta</h3>
                            <div className="suggestion-grid">
                                <div className="suggestion-item">
                                    <h4>Meta Titre</h4>
                                    <p className="current-meta"><strong>Actuel :</strong> {results.optimizationSuggestions.metaTitle.current}</p>
                                    <div className="editable-meta-container">
                                        <label htmlFor="suggested-meta-title-input" className="form-label">Suggéré (modifiable)</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                id="suggested-meta-title-input"
                                                type="text"
                                                className="form-input suggested-meta-input"
                                                value={editableMetaTitle}
                                                onChange={(e) => setEditableMetaTitle(e.target.value)}
                                            />
                                            <span className={`char-counter ${editableMetaTitle.length > 60 ? 'limit-exceeded' : ''}`}>
                                                {editableMetaTitle.length} / 60
                                            </span>
                                        </div>
                                    </div>
                                    <p className="reasoning">{results.optimizationSuggestions.metaTitle.reasoning}</p>
                                </div>
                                <div className="suggestion-item">
                                    <h4>Meta Description</h4>
                                    <p className="current-meta"><strong>Actuel :</strong> {results.optimizationSuggestions.metaDescription.current}</p>
                                    <p className="suggested-meta"><strong>Suggéré :</strong> {results.optimizationSuggestions.metaDescription.suggested}</p>
                                    <p className="reasoning">{results.optimizationSuggestions.metaDescription.reasoning}</p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            )}

            <StickyFooter
                creditCost={30}
                buttonText="Lancer l'Analyse"
                onButtonClick={handleAnalysis}
                isButtonDisabled={loading || !productUrl.trim()}
                buttonLoadingText="Analyse en cours..."
            />

        </div>
    );
};


// --- CRO OPTIMIZATION PAGE ---
interface CroOptimizationPageProps {
    ai: GoogleGenAI;
}

interface CroResult {
    url: string;
    data: any; // The JSON response from the API
}

const CroAuditDetail: React.FC<{ auditData: any }> = ({ auditData }) => {
    if (!auditData || !auditData.detailedAudit) {
        return <p>Données d'audit détaillées non disponibles.</p>;
    }

    const auditCategories = [
        { key: 'valueProposition', title: 'Proposition de Valeur & Clarté' },
        { key: 'visualsAndMedia', title: 'Visuels & Médias' },
        { key: 'productDescription', title: 'Description & Contenu' },
        { key: 'callToAction', title: 'Appel à l\'Action (CTA)' },
        { key: 'trustAndReassurance', title: 'Confiance & Réassurance' },
    ];

    return (
        <div className="product-analysis-grid" style={{ marginTop: '24px' }}>
            {auditCategories.map(category => {
                const data = auditData.detailedAudit[category.key];
                if (!data) return null;

                return (
                    <div key={category.key} className="analysis-result-card">
                        <div className="cro-card-header">
                           <h3 className="card-title-small">{category.title}</h3>
                           <div className="cro-card-score">{data.score}</div>
                        </div>
                        
                        {data.strengths?.length > 0 && (
                            <>
                                <h4>Points Forts</h4>
                                <ul>{data.strengths.map((item: string, i: number) => <li key={i} className="strength">{item}</li>)}</ul>
                            </>
                        )}
                        {data.weaknesses?.length > 0 && (
                             <>
                                <h4>Points Faibles</h4>
                                <ul>{data.weaknesses.map((item: string, i: number) => <li key={i} className="weakness">{item}</li>)}</ul>
                            </>
                        )}
                        {data.recommendations?.length > 0 && (
                             <>
                                <h4>Recommandations</h4>
                                <ul className="recommendation-list-items">{data.recommendations.map((item: string, i: number) => <li key={i}>{item}</li>)}</ul>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
    );
};


const CroOptimizationPage: React.FC<CroOptimizationPageProps> = ({ ai }) => {
    const [productUrlsInput, setProductUrlsInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<CroResult[]>([]);
    const [generationProgress, setGenerationProgress] = useState('');

    const urlsToAnalyze = productUrlsInput.split('\n').map(url => url.trim()).filter(url => url.length > 0 && url.startsWith('http'));
    const creditCost = urlsToAnalyze.length * 40;

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                const urls = text.split(/[\r\n]+/).map(line => line.split(',')[0].trim()).filter(Boolean);
                setProductUrlsInput(urls.join('\n'));
            };
            reader.readAsText(file);
             e.target.value = ''; // Reset file input
        }
    }, []);

    const handleExport = useCallback(() => {
        if (results.length === 0) return;

        const escapeCsv = (field: string | number | undefined) => `"${(field?.toString() || '').replace(/"/g, '""')}"`;
        const headers = ["URL", "Overall Score", "Summary", "Audit Category", "Category Score", "Strengths", "Weaknesses", "Recommendations"];
        
        let csvContent = headers.join(',') + '\r\n';

        results.forEach(result => {
            const { url, data } = result;
            if (data && data.detailedAudit) {
                const auditCategories = [
                    { key: 'valueProposition', title: 'Proposition de Valeur & Clarté' },
                    { key: 'visualsAndMedia', title: 'Visuels & Médias' },
                    { key: 'productDescription', title: 'Description & Contenu' },
                    { key: 'callToAction', title: 'Appel à l\'Action (CTA)' },
                    { key: 'trustAndReassurance', title: 'Confiance & Réassurance' },
                ];

                auditCategories.forEach(category => {
                    const auditItem = data.detailedAudit[category.key];
                    if (auditItem) {
                        const row = [
                            escapeCsv(url),
                            escapeCsv(data.overallScore),
                            escapeCsv(data.summary),
                            escapeCsv(category.title),
                            escapeCsv(auditItem.score),
                            escapeCsv(auditItem.strengths?.join('\n')),
                            escapeCsv(auditItem.weaknesses?.join('\n')),
                            escapeCsv(auditItem.recommendations?.join('\n'))
                        ];
                        csvContent += row.join(',') + '\r\n';
                    }
                });
            } else {
                 const row = [
                    escapeCsv(url),
                    escapeCsv(data?.overallScore),
                    escapeCsv(data?.summary || 'No detailed audit available.'),
                    "", "", "", "", ""
                ];
                csvContent += row.join(',') + '\r\n';
            }
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const blobUrl = URL.createObjectURL(blob);
        link.setAttribute("href", blobUrl);
        link.setAttribute("download", "cro_audit_export_detailed.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [results]);

    const handleAnalysis = useCallback(async () => {
        if (urlsToAnalyze.length === 0) {
            setError("Veuillez entrer au moins une URL de fiche produit valide.");
            return;
        }
        setLoading(true);
        setError(null);
        setResults([]);
        const currentResults: CroResult[] = [];

        try {
            const promptTemplate = `
                En tant qu'expert en CRO (Conversion Rate Optimization) spécialisé en e-commerce, audite la fiche produit à l'URL suivante: %%URL%%.
                Fournis une analyse approfondie et structurée. Ta réponse DOIT être un objet JSON valide et rien d'autre.
                L'objet JSON doit avoir la structure suivante :
                {
                  "overallScore": "Un score global de 1 à 10, basé sur le potentiel de conversion de la page.",
                  "summary": "Un résumé concis des 2-3 points les plus critiques à améliorer pour augmenter les conversions.",
                  "detailedAudit": {
                    "valueProposition": {
                      "score": "Score de 1 à 10",
                      "strengths": ["Liste des points forts, ex: Titre clair et orienté bénéfice."],
                      "weaknesses": ["Liste des points faibles, ex: Les bénéfices clés ne sont pas visibles au-dessus de la ligne de flottaison."],
                      "recommendations": ["Liste des actions concrètes à mettre en place."]
                    },
                    "visualsAndMedia": {
                      "score": "Score de 1 à 10",
                      "strengths": ["ex: Images haute résolution, zoom fonctionnel."],
                      "weaknesses": ["ex: Manque de vidéo produit, pas d'images en contexte."],
                      "recommendations": ["ex: Ajouter une vidéo de démonstration de 30 secondes."]
                    },
                    "productDescription": {
                      "score": "Score de 1 à 10",
                      "strengths": ["ex: Texte facile à lire, utilise des listes à puces."],
                      "weaknesses": ["ex: Le ton n'est pas assez persuasif."],
                      "recommendations": ["ex: Réécrire le premier paragraphe pour créer un lien émotionnel."]
                    },
                    "callToAction": {
                      "score": "Score de 1 à 10",
                      "strengths": ["ex: Couleur contrastante, texte clair."],
                      "weaknesses": ["ex: Le bouton est placé trop bas sur la page mobile."],
                      "recommendations": ["ex: Rendre le bouton d'ajout au panier 'sticky' sur mobile."]
                    },
                    "trustAndReassurance": {
                      "score": "Score de 1 à 10",
                      "strengths": ["ex: Avis clients visibles."],
                      "weaknesses": ["ex: Manque de badges de sécurité, politique de retour peu claire."],
                      "recommendations": ["ex: Afficher les logos des modes de paiement et un badge SSL près du CTA."]
                    }
                  }
                }
            `;

            for (let i = 0; i < urlsToAnalyze.length; i++) {
                const url = urlsToAnalyze[i];
                setGenerationProgress(`Analyse ${i + 1}/${urlsToAnalyze.length} : ${url}`);
                const prompt = promptTemplate.replace('%%URL%%', url);
                
                try {
                     const response = await ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: prompt,
                        config: { tools: [{ googleSearch: {} }] },
                    });
                    
                    const parsedJson = extractJsonFromResponse(response.text);
                    currentResults.push({ url, data: parsedJson });
                    setResults([...currentResults]);
                } catch (e: any) {
                    currentResults.push({ url, data: { error: true, summary: `Analyse échouée: ${e.message}`, overallScore: 'Erreur' }});
                    setResults([...currentResults]);
                }
            }

        } catch (e: any) {
            setError(`Une erreur majeure est survenue pendant le processus de bulk. Détails: ${e.message}`);
        } finally {
            setLoading(false);
            setGenerationProgress('');
        }
    }, [ai.models, urlsToAnalyze]);
    
    return (
        <div>
            <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Optimisation de la Conversion (CRO)</h2>
                    <p className="content-subtitle">Recevez des recommandations d'experts pour améliorer vos fiches produits, en masse.</p>
                </div>
            </div>
             <div className="content-card">
                <div className="form-group">
                    <label htmlFor="product-urls-cro" className="form-label">URLs des fiches produits (1 par ligne)</label>
                    <textarea 
                        id="product-urls-cro" 
                        className="form-textarea" 
                        value={productUrlsInput} 
                        onChange={(e) => setProductUrlsInput(e.target.value)} 
                        placeholder="https://www.votresite.com/produit-1&#10;https://www.votresite.com/produit-2" 
                        disabled={loading}
                        style={{ minHeight: '150px' }}
                    ></textarea>
                    <label htmlFor="csv-upload-cro" className="button-secondary" style={{marginTop: '10px', display: 'inline-block'}}>
                        <span>Ou charger un fichier CSV</span>
                        <input type="file" id="csv-upload-cro" accept=".csv" onChange={handleFileChange} style={{display: 'none'}} />
                    </label>
                </div>
                 <button onClick={handleAnalysis} className="submit-button" disabled={loading || urlsToAnalyze.length === 0}>
                    {loading ? <><span className="spinner"></span> Audit en cours...</> : `Lancer l'audit (${urlsToAnalyze.length} URLs)`}
                </button>
                 <p className="credit-cost-text">Coût total estimé : {creditCost} crédits</p>
                 {loading && <p className="generation-progress" style={{textAlign: 'center', marginTop: '12px'}}>{generationProgress}</p>}
            </div>
            
            {error && <div className="error-message" role="alert">{error}</div>}
            
            {results.length > 0 && (
                <div className="cro-results-container">
                    <div className="page-header-actions" style={{marginBottom: 0}}>
                        <h3 className="output-label" style={{border: 'none', padding: 0, margin: 0}}>Résultats de l'Audit ({results.length} / {urlsToAnalyze.length} terminées)</h3>
                        <button className="submit-button" onClick={handleExport}>
                            Exporter en CSV
                        </button>
                    </div>
                    
                    {results.map((result, index) => (
                        <div key={index} className="content-card cro-result-item">
                            <details open>
                                <summary className="cro-result-summary-header">
                                    <div className="cro-summary-url">
                                        <a href={result.url} target="_blank" rel="noopener noreferrer" title={result.url}>{result.url}</a>
                                    </div>
                                    <div className="cro-summary-score">
                                        <strong>Score Global :</strong> {result.data.error ? <span style={{ color: 'var(--error-text)'}}>Erreur</span> : `${result.data.overallScore || 'N/A'}`}
                                    </div>
                                </summary>
                                <div className="cro-result-details">
                                     <p className="cro-result-main-summary">
                                        <strong>Résumé de l'audit :</strong> {result.data.summary}
                                     </p>
                                     {result.data.error ? 
                                        <p style={{ color: 'var(--error-text)'}}>L'analyse détaillée n'a pas pu être générée.</p> 
                                        : <CroAuditDetail auditData={result.data} />
                                     }
                                </div>
                            </details>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- FAQ GENERATOR PAGE ---
interface FaqGeneratorPageProps {
    ai: GoogleGenAI;
}
const FaqGeneratorPage: React.FC<FaqGeneratorPageProps> = ({ ai }) => {
    const [method, setMethod] = useState<'topic' | 'url'>('topic');
    const [topic, setTopic] = useState('');
    const [externalUrl, setExternalUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [faq, setFaq] = useState<{ question: string; answer: string; }[] | null>(null);
    const [generatedJsonLd, setGeneratedJsonLd] = useState<string | null>(null);

    const handleGenerateFaq = useCallback(async () => {
        let prompt: string;
        let config: any = {};
        
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                faqItems: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question: { type: Type.STRING },
                            answer: { type: Type.STRING },
                        },
                        required: ["question", "answer"],
                    }
                },
                jsonLd: {
                    type: Type.STRING,
                    description: 'A string containing the complete JSON-LD for an FAQPage.'
                }
            },
            required: ["faqItems", "jsonLd"]
        };

        if (method === 'topic') {
            if (!topic.trim()) {
                setError("Veuillez entrer un sujet pour générer la FAQ.");
                return;
            }
            prompt = `Generate a list of 5 frequently asked questions (FAQ) about the topic "${topic}". For each question, provide a concise and helpful answer. Also generate a valid JSON-LD script for an FAQPage rich result based on these questions and answers. The response must be a valid JSON object.`;
            config = {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            };
        } else { // method === 'url'
            if (!externalUrl.trim()) {
                setError("Veuillez entrer une URL valide.");
                return;
            }
            try { new URL(externalUrl); } catch (_) {
                setError("Le format de l'URL est invalide.");
                return;
            }
            prompt = `Analyze the content of the page at the URL ${externalUrl}. Based on this content, generate a list of 5 frequently asked questions (FAQ) with concise and helpful answers. Also generate a valid JSON-LD script for an FAQPage rich result based on these questions and answers. The response must be a valid JSON object.`;
            config = { 
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: responseSchema
            };
        }

        setLoading(true);
        setError(null);
        setFaq(null);
        setGeneratedJsonLd(null);

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: config,
            });
            const parsedResponse = extractJsonFromResponse(response.text);
            setFaq(parsedResponse.faqItems);
            setGeneratedJsonLd(parsedResponse.jsonLd);

        } catch (e: any) {
            setError(`Une erreur est survenue lors de la génération : ${e.message}. Veuillez vérifier votre saisie ou l'URL.`);
        } finally {
            setLoading(false);
        }
    }, [ai.models, method, topic, externalUrl]);
    
    const isButtonDisabled = loading || (method === 'topic' && !topic.trim()) || (method === 'url' && !externalUrl.trim());

    return (
        <div>
             <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Générateur de FAQ</h2>
                    <p className="content-subtitle">Créez rapidement une section FAQ pertinente pour un sujet ou une page web.</p>
                </div>
            </div>
            <div className="content-card">
                 <div className="form-group">
                    <label className="form-label">Choisir la source du contenu</label>
                    <div className="method-selector">
                        <label className={method === 'topic' ? 'active' : ''}>
                            <input type="radio" name="method-faq" value="topic" checked={method === 'topic'} onChange={() => setMethod('topic')} />
                            <span>À partir d'un sujet</span>
                        </label>
                        <label className={method === 'url' ? 'active' : ''}>
                            <input type="radio" name="method-faq" value="url" checked={method === 'url'} onChange={() => setMethod('url')} />
                            <span>À partir d'une URL</span>
                        </label>
                    </div>
                </div>

                <div className="method-content">
                    {method === 'topic' ? (
                        <div className="form-group">
                            <label htmlFor="faq-topic" className="form-label">Sujet de la FAQ</label>
                            <input id="faq-topic" type="text" className="form-input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex: Voyage au Japon" disabled={loading} />
                        </div>
                    ) : (
                        <div className="form-group">
                            <label htmlFor="url-input-faq" className="form-label">Entrer l'URL de la page à analyser</label>
                            <input id="url-input-faq" type="text" className="form-input" value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://www.exemple.com/article" disabled={loading} />
                        </div>
                    )}
                </div>

                <button className="submit-button" onClick={handleGenerateFaq} disabled={isButtonDisabled}>
                    {loading ? <><span className="spinner"></span> Génération...</> : "Générer la FAQ"}
                </button>
                 <p className="credit-cost-text">Coût de la génération : 20 crédits</p>
            </div>
            {error && <div className="error-message" role="alert">{error}</div>}
            {faq && (
                <div className="content-card" style={{marginTop: '24px'}}>
                     <h3 className="output-label">FAQ Générée :</h3>
                     <div className="faq-accordion">
                        {faq.map((item, index) => (
                            <details key={index} className="faq-item">
                                <summary className="faq-question">{item.question}</summary>
                                <div className="faq-answer">
                                    <p>{item.answer}</p>
                                </div>
                            </details>
                        ))}
                     </div>
                </div>
            )}
             {generatedJsonLd && (
                <div className="content-card" style={{marginTop: '24px'}}>
                    <h3 className="output-label">JSON-LD pour Rich Results (FAQPage)</h3>
                    <div className="code-block-container">
                        <pre className="code-block"><code>{generatedJsonLd}</code></pre>
                        <button onClick={(e) => handleCopy(generatedJsonLd, e)} className="copy-code-button">Copier</button>
                    </div>
                    <p className="form-helper-text">Intégrez ce script dans la balise &lt;head&gt; de votre page pour que Google puisse afficher des résultats enrichis.</p>
                </div>
            )}
        </div>
    );
};

// --- SUMMARY TABLE GENERATOR PAGE ---
interface SummaryTableGeneratorPageProps {
    ai: GoogleGenAI;
}
const SummaryTableGeneratorPage: React.FC<SummaryTableGeneratorPageProps> = ({ ai }) => {
    const [externalUrl, setExternalUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [generatedTableHtml, setGeneratedTableHtml] = useState<string | null>(null);
    const [generatedJsonLd, setGeneratedJsonLd] = useState<string | null>(null);

    const handleGenerate = useCallback(async () => {
        if (!externalUrl.trim()) {
            setError("Veuillez entrer une URL valide.");
            return;
        }
        try {
            new URL(externalUrl);
        } catch (_) {
            setError("Le format de l'URL est invalide.");
            return;
        }

        setLoading(true);
        setError(null);
        setGeneratedTableHtml(null);
        setGeneratedJsonLd(null);

        try {
            const prompt = `
                Tu es un expert en analyse de contenu et en SEO. Analyse le contenu de la page web à l'URL suivante: ${externalUrl}.
                Ta mission est de générer deux choses :
                1. Un tableau récapitulatif HTML qui est à la fois un résumé et un complément au contenu. Ce tableau doit avoir les en-têtes: "Thème Principal", "Points Clés", et "Informations Complémentaires / Actions".
                2. Un script JSON-LD valide pour un 'Article' rich result, basé sur le contenu de la page. Le JSON-LD doit inclure @context, @type, headline, image, author, publisher, datePublished, dateModified, et description. Extrais ces informations de la page.

                Le résultat doit être UNIQUEMENT un objet JSON valide.
            `;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    tableHtml: { type: Type.STRING, description: "Le tableau récapitulatif au format HTML." },
                    jsonLd: { type: Type.STRING, description: "Le script JSON-LD complet pour un Article." }
                },
                required: ["tableHtml", "jsonLd"]
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: { 
                    tools: [{ googleSearch: {} }],
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });
            const parsedResponse = extractJsonFromResponse(response.text);
            setGeneratedTableHtml(parsedResponse.tableHtml);
            setGeneratedJsonLd(parsedResponse.jsonLd);

        } catch (e: any) {
            setError(`Une erreur est survenue: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }, [ai.models, externalUrl]);
    
    const isButtonDisabled = loading || !externalUrl.trim();

    return (
        <div>
            <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Générer un Tableau Récapitulatif</h2>
                    <p className="content-subtitle">Créez un tableau de synthèse à partir d'une URL externe.</p>
                </div>
            </div>

            <div className="content-card">
                <div className="method-content">
                    <div className="form-group">
                        <label htmlFor="url-input" className="form-label">Entrer l'URL de la page à analyser</label>
                        <input id="url-input" type="text" className="form-input" value={externalUrl} onChange={e => setExternalUrl(e.target.value)} placeholder="https://www.exemple.com/article" disabled={loading} />
                    </div>
                </div>

                 <button className="submit-button" onClick={handleGenerate} disabled={isButtonDisabled}>
                    {loading ? <><span className="spinner"></span> Génération en cours...</> : "Générer le Tableau"}
                </button>
                 <p className="credit-cost-text">Coût de la génération : 20 crédits</p>
            </div>

            {error && <div className="error-message" role="alert">{error}</div>}

            {generatedTableHtml && (
                <div className="content-card" style={{marginTop: '24px'}}>
                     <h3 className="output-label">Tableau Généré :</h3>
                     <div className="generated-summary-table" dangerouslySetInnerHTML={{ __html: generatedTableHtml }}></div>
                </div>
            )}
            {generatedJsonLd && (
                <div className="content-card" style={{marginTop: '24px'}}>
                    <h3 className="output-label">JSON-LD pour Rich Results (Article)</h3>
                    <div className="code-block-container">
                        <pre className="code-block"><code>{generatedJsonLd}</code></pre>
                         <button onClick={(e) => handleCopy(generatedJsonLd, e)} className="copy-code-button">Copier</button>
                    </div>
                    <p className="form-helper-text">Intégrez ce script dans la balise &lt;head&gt; de votre page pour que Google puisse afficher des résultats enrichis.</p>
                </div>
            )}
        </div>
    );
};

const SettingsPage: React.FC = () => {
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [newCollaboratorEmail, setNewCollaboratorEmail] = useState('');
    const [error, setError] = useState('');
    // FIX: Explicitly pass the generic type `Collaborator` to `useSortableData` to ensure correct type inference for `requestSort` when the initial array is empty.
    const { items: sortedCollaborators, requestSort, sortConfig } = useSortableData<Collaborator>(collaborators);

    const getSortClassFor = (key: keyof Collaborator) => {
        if (!sortConfig) {
            return '';
        }
        return sortConfig.key === key ? sortConfig.direction : '';
    };

    useEffect(() => {
        setCollaborators(loadFromLocalStorage<Collaborator[]>(LOCAL_STORAGE_COLLABORATORS, []));
    }, []);

    const saveCollaborators = useCallback((updatedCollaborators: Collaborator[]) => {
        setCollaborators(updatedCollaborators);
        saveToLocalStorage(LOCAL_STORAGE_COLLABORATORS, updatedCollaborators);
    }, []);

    const handleAddCollaborator = useCallback(() => {
        if (!newCollaboratorEmail.trim() || !/\S+@\S+\.\S+/.test(newCollaboratorEmail)) {
            setError("Veuillez entrer une adresse email valide.");
            return;
        }
        if (collaborators.length >= MAX_COLLABORATORS) {
            setError(`Vous ne pouvez pas ajouter plus de ${MAX_COLLABORATORS} collaborateurs.`);
            return;
        }
        if (collaborators.some(c => c.email === newCollaboratorEmail.trim())) {
            setError("Ce collaborateur existe déjà.");
            return;
        }

        const newCollaborator: Collaborator = {
            id: `collab_${Date.now()}`,
            email: newCollaboratorEmail.trim(),
            invitationDate: new Date().toISOString(),
            creditsUsedMock: 0,
            lastActivityMock: new Date().toISOString(),
        };

        saveCollaborators([...collaborators, newCollaborator]);
        setNewCollaboratorEmail('');
        setError('');
    }, [collaborators, newCollaboratorEmail, saveCollaborators]);

    const handleDeleteCollaborator = useCallback((collaboratorId: string) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce collaborateur ?")) {
            const updatedCollaborators = collaborators.filter(c => c.id !== collaboratorId);
            saveCollaborators(updatedCollaborators);
        }
    }, [collaborators, saveCollaborators]);

    return (
        <div>
            <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Paramètres</h2>
                    <p className="content-subtitle">Gérez les collaborateurs et les paramètres de votre compte.</p>
                </div>
            </div>
            <div className="content-card">
                <h3 className="output-label">Gestion des Collaborateurs</h3>
                <p>Invitez des membres de votre équipe à collaborer sur vos projets. Vous pouvez ajouter jusqu'à {MAX_COLLABORATORS} collaborateurs.</p>
                <div className="form-group">
                    <label htmlFor="new-collaborator-email" className="form-label">Email du collaborateur à inviter</label>
                    <div className="input-with-button">
                        <input
                            id="new-collaborator-email"
                            type="email"
                            className="form-input"
                            value={newCollaboratorEmail}
                            onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                            placeholder="nom@exemple.com"
                            disabled={collaborators.length >= MAX_COLLABORATORS}
                        />
                        <button onClick={handleAddCollaborator} className="submit-button" disabled={collaborators.length >= MAX_COLLABORATORS}>Inviter</button>
                    </div>
                    {error && <p className="error-message" style={{marginTop: '8px', marginBottom: 0}}>{error}</p>}
                </div>

                <div className="table-responsive" style={{marginTop: '24px'}}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('email')} className={`sortable-header ${getSortClassFor('email')}`}>Email</th>
                                <th onClick={() => requestSort('invitationDate')} className={`sortable-header ${getSortClassFor('invitationDate')}`}>Date d'invitation</th>
                                <th onClick={() => requestSort('creditsUsedMock')} className={`sortable-header ${getSortClassFor('creditsUsedMock')}`}>Crédits utilisés (Mock)</th>
                                <th onClick={() => requestSort('lastActivityMock')} className={`sortable-header ${getSortClassFor('lastActivityMock')}`}>Dernière activité (Mock)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCollaborators.length > 0 ? sortedCollaborators.map(c => (
                                <tr key={c.id}>
                                    <td>{c.email}</td>
                                    <td>{new Date(c.invitationDate).toLocaleDateString()}</td>
                                    <td>{c.creditsUsedMock}</td>
                                    <td>{new Date(c.lastActivityMock || '').toLocaleDateString()}</td>
                                    <td>
                                        <button className="button-link-delete" onClick={() => handleDeleteCollaborator(c.id)}>Supprimer</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} style={{textAlign: 'center', padding: '24px'}}>Aucun collaborateur invité.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

interface MyAccountProfilePageProps {
    userProfile: UserProfileData;
    onProfileUpdate: (profile: UserProfileData) => void;
}

const MyAccountProfilePage: React.FC<MyAccountProfilePageProps> = ({ userProfile, onProfileUpdate }) => {
    const [formData, setFormData] = useState<UserProfileData>(userProfile);
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        setFormData(userProfile);
    }, [userProfile]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        onProfileUpdate(formData);
        setSuccessMessage('Profil mis à jour avec succès !');
        setTimeout(() => setSuccessMessage(''), 3000);
    }, [formData, onProfileUpdate]);

    return (
        <div>
            <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Mon Profil</h2>
                    <p className="content-subtitle">Gérez vos informations personnelles et préférences.</p>
                </div>
            </div>
            <div className="content-card">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="firstName" className="form-label">Prénom</label>
                        <input type="text" id="firstName" name="firstName" className="form-input" value={formData.firstName} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="lastName" className="form-label">Nom de famille</label>
                        <input type="text" id="lastName" name="lastName" className="form-input" value={formData.lastName} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email" className="form-label">Email</label>
                        <input type="email" id="email" name="email" className="form-input" value={formData.email} disabled readOnly />
                        <p className="form-helper-text">L'adresse email ne peut pas être modifiée.</p>
                    </div>
                    <div className="form-group">
                        <label htmlFor="language" className="form-label">Langue de l'interface</label>
                        <select id="language" name="language" className="form-select" value={formData.language} onChange={handleChange}>
                            {languageOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <button type="submit" className="submit-button">Sauvegarder les modifications</button>
                    {successMessage && <div className="success-message" style={{marginTop: '15px'}}>{successMessage}</div>}
                </form>
            </div>
        </div>
    );
};

interface BillingHistoryItem {
    id: number;
    date: string;
    description: string;
    amount: number;
    invoiceUrl: string;
}

const BillingPage: React.FC<{ navigateTo: (page: Page) => void }> = ({ navigateTo }) => {
    const currentUserPlan = pricingPlans.find(p => p.id === 'pro')!;
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    const creditsUsed = 150;
    const creditsTotal = currentUserPlan.credits as number;

    const [billingHistory] = useState<BillingHistoryItem[]>([
        { id: 1, date: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString(), description: 'Abonnement Plan Pro', amount: currentUserPlan.monthlyPrice, invoiceUrl: '#' },
        { id: 2, date: new Date(new Date().setMonth(new Date().getMonth() - 2)).toISOString(), description: 'Abonnement Plan Pro', amount: currentUserPlan.monthlyPrice, invoiceUrl: '#' },
    ]);

    // FIX: Explicitly pass the generic type `BillingHistoryItem` to `useSortableData` to ensure correct type inference for `requestSort`.
    const { items: sortedHistory, requestSort, sortConfig } = useSortableData<BillingHistoryItem>(billingHistory, { key: 'date', direction: 'descending' });

    const getSortClassFor = (key: keyof BillingHistoryItem) => {
        if (!sortConfig) {
            return '';
        }
        return sortConfig.key === key ? sortConfig.direction : '';
    };

    return (
        <div>
            <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Facturation et Abonnement</h2>
                    <p className="content-subtitle">Consultez votre plan actuel, votre utilisation et votre historique de facturation.</p>
                </div>
            </div>
            <div className="billing-grid">
                <div className="content-card">
                    <h3>Votre Plan Actuel</h3>
                    <div className="current-plan-display">
                        <h4 style={{ color: 'var(--primary-blue)' }}>{currentUserPlan.name}</h4>
                        <p className="plan-price">{currentUserPlan.monthlyPrice} €<span>/ mois</span></p>
                        <p>Prochaine facturation le : {nextBillingDate.toLocaleDateString('fr-FR')}</p>
                        <button className="submit-button" onClick={() => navigateTo('plans-pricing')}>
                            Voir tous les plans et options
                        </button>
                    </div>
                </div>
                <div className="content-card">
                    <h3>Utilisation des Crédits ce Mois-ci</h3>
                    <div className="credits-usage-display">
                        <p className="credits-metric">
                            <span style={{ fontSize: '2em', color: 'var(--text-primary)' }}>{creditsUsed}</span> / {creditsTotal}
                        </p>
                        <div className="progress-bar-container">
                            <div className="progress-bar" style={{ width: `${(creditsUsed / creditsTotal) * 100}%` }}></div>
                        </div>
                        <p>Les crédits sont réinitialisés le {nextBillingDate.toLocaleDateString('fr-FR')}.</p>
                    </div>
                </div>
                <div className="content-card">
                    <h3>Besoin de plus de crédits ?</h3>
                     <p>Rechargez votre compte pour ne jamais être à court de ressources créatives. L'achat est unique et les crédits ne se périment pas.</p>
                     <div className="credit-reload-offer">
                        <p className="credits-metric"><strong>1000</strong> crédits pour <strong>20 €</strong></p>
                        <button className="button-secondary" style={{marginTop: '16px'}} onClick={() => alert('Fonctionnalité de recharge bientôt disponible !')}>
                            Recharger des Crédits
                        </button>
                     </div>
                </div>
            </div>
             <div className="content-card" style={{ marginTop: '24px' }}>
                <h3>Gestion de l'abonnement</h3>
                <p className="form-helper-text" style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                    Votre abonnement se renouvelle automatiquement. Vous pouvez annuler à tout moment depuis les paramètres de votre compte. L'annulation prendra effet à la fin de la période de facturation en cours (mensuelle ou annuelle). Conformément à nos conditions, aucun remboursement n'est effectué pour les périodes entamées.
                </p>
            </div>
            <div className="content-card" style={{ marginTop: '24px' }}>
                <h3>Historique de Facturation</h3>
                <div className="table-responsive">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('date')} className={`sortable-header ${getSortClassFor('date')}`}>Date</th>
                                <th onClick={() => requestSort('description')} className={`sortable-header ${getSortClassFor('description')}`}>Description</th>
                                <th onClick={() => requestSort('amount')} className={`sortable-header ${getSortClassFor('amount')}`}>Montant</th>
                                <th>Facture</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedHistory.map(item => (
                                <tr key={item.id}>
                                    <td>{new Date(item.date).toLocaleDateString('fr-FR')}</td>
                                    <td>{item.description}</td>
                                    <td>{item.amount.toFixed(2)} €</td>
                                    <td><a href={item.invoiceUrl} onClick={(e) => e.preventDefault()}>Télécharger</a></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const SpecsForDevPage: React.FC = () => {
    return (
        <div>
            <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Spécifications Techniques pour le Backend</h2>
                    <p className="content-subtitle">Cahier des charges pour la migration de `localStorage` vers une base de données PostgreSQL avec une API REST.</p>
                </div>
            </div>
            <div className="content-card specs-page-content">
                <h3>1. Objectif</h3>
                <p>L'objectif est de remplacer le système de persistance de données actuel, basé sur le `localStorage` du navigateur, par une architecture backend robuste. Cela permettra la persistance des données à long terme, la possibilité de comptes multi-utilisateurs et une meilleure scalabilité de l'application.</p>
                
                <h3>2. Architecture Générale</h3>
                <ul>
                    <li><strong>Serveur Backend :</strong> Node.js avec le framework Express.js est recommandé.</li>
                    <li><strong>Base de Données :</strong> PostgreSQL.</li>
                    <li><strong>API :</strong> Une API RESTful sera exposée pour permettre au frontend de communiquer avec le serveur.</li>
                    <li><strong>Authentification :</strong> Un système d'authentification basé sur des tokens (JWT - JSON Web Tokens) devra être implémenté pour sécuriser les points de terminaison.</li>
                </ul>

                <h3>3. Modèle de Données (Schéma PostgreSQL)</h3>
                <p>Les interfaces TypeScript actuelles doivent être traduites en tables SQL. Une nouvelle table `users` est nécessaire pour gérer les comptes.</p>
                
                <h4>Table: `users`</h4>
                <pre><code>
{`CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);`}
                </code></pre>

                <h4>Table: `user_profiles`</h4>
                <pre><code>
{`CREATE TABLE user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    language VARCHAR(10) DEFAULT 'fr',
    stripe_customer_id VARCHAR(255)
);`}
                </code></pre>

                <h4>Table: `projects`</h4>
                <pre><code>
{`CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT,
    cms VARCHAR(50),
    creation_date TIMESTAMPTZ NOT NULL,
    gsc_connected BOOLEAN DEFAULT FALSE,
    ga_connected BOOLEAN DEFAULT FALSE
);`}
                </code></pre>

                <h4>Table: `collaborators`</h4>
                <pre><code>
{`CREATE TABLE collaborators (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    invitation_date TIMESTAMPTZ NOT NULL
);`}
                </code></pre>

                 <h4>Table: `competitive_analyses`</h4>
                <pre><code>
{`CREATE TABLE competitive_analyses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    urls TEXT[],
    results JSONB NOT NULL
);`}
                </code></pre>

                <h3>4. Points de Terminaison de l'API (Endpoints)</h3>
                <p>Tous les endpoints, à l'exception de `/register` et `/login`, doivent être protégés et nécessiter un token JWT valide.</p>

                <h4>Authentification</h4>
                <ul>
                    <li><code>POST /api/auth/register</code>: Crée un nouvel utilisateur. Corps: {'{ email, password }'}.</li>
                    <li><code>POST /api/auth/login</code>: Authentifie un utilisateur. Corps: {'{ email, password }'}. Retourne un JWT.</li>
                </ul>

                <h4>Profil Utilisateur (`/api/profile`)</h4>
                 <ul>
                    <li><code>GET /</code>: Récupère le profil de l'utilisateur authentifié.</li>
                    <li><code>PUT /</code>: Met à jour le profil de l'utilisateur authentifié.</li>
                </ul>

                <h4>Projets (`/api/projects`)</h4>
                <ul>
                    <li><code>GET /</code>: Liste tous les projets de l'utilisateur authentifié.</li>
                    <li><code>POST /</code>: Crée un nouveau projet.</li>
                    <li><code>PUT /:id</code>: Met à jour un projet spécifique.</li>
                    <li><code>DELETE /:id</code>: Supprime un projet spécifique.</li>
                </ul>

                 <h4>Analyses Concurrentielles (`/api/analyses`)</h4>
                 <ul>
                    <li><code>GET /</code>: Liste toutes les analyses sauvegardées pour l'utilisateur.</li>
                    <li><code>POST /</code>: Sauvegarde une nouvelle analyse.</li>
                    <li><code>DELETE /:id</code>: Supprime une analyse sauvegardée.</li>
                </ul>

                <h3>5. Considérations de Sécurité</h3>
                <ul>
                    <li><strong>Validation des Entrées :</strong> Valider et nettoyer toutes les données reçues du client pour prévenir les injections SQL et les attaques XSS.</li>
                    <li><strong>Hashing des Mots de Passe :</strong> Utiliser un algorithme de hashing robuste comme `bcrypt` pour stocker les mots de passe.</li>
                    <li><strong>CORS :</strong> Configurer CORS pour n'autoriser que les requêtes provenant du domaine de l'application frontend.</li>
                    <li><strong>Variables d'Environnement :</strong> Utiliser un fichier `.env` pour stocker les informations sensibles (URL de la base de données, secret JWT, etc.).</li>
                </ul>

                 <h3>6. Tâches pour le Frontend</h3>
                <p>Une fois l'API prête, le développeur frontend devra :</p>
                <ol>
                    <li>Remplacer tous les appels à `localStorage` par des requêtes `fetch` vers les nouveaux endpoints de l'API.</li>
                    <li>Implémenter un flux d'authentification (login/logout) et gérer le stockage sécurisé du JWT.</li>
                    <li>Ajouter des états de chargement (`loading`) et de gestion des erreurs (`error`) pour tous les appels API.</li>
                    <li>Transmettre le token JWT dans les en-têtes `Authorization` pour les requêtes protégées.</li>
                </ol>
            </div>
        </div>
    );
};

const RoadmapDevPage: React.FC = () => {
    return (
        <div className="content-card">
            <h2 className="content-title">Roadmap de Développement</h2>
            <p>Cette page est en cours de construction. Revenez bientôt pour voir nos prochaines fonctionnalités !</p>
        </div>
    );
};

const SummaryPage: React.FC = () => {
    return (
        <div className="content-card">
            <h2 className="content-title">Résumé & Personas</h2>
            <p>Cette page est en cours de construction. Bientôt, vous pourrez générer des résumés et des personas ici.</p>
        </div>
    );
};

const OnlineHelpPage: React.FC = () => {
    return (
        <div className="content-card">
            <h2 className="content-title">Aide en Ligne</h2>
            <p>Notre centre d'aide est en cours de développement. Pour toute question, veuillez contacter le support.</p>
        </div>
    );
};

const PlansPricingPage: React.FC<{ navigateTo: (page: Page) => void }> = ({ navigateTo }) => {
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

    const handlePlanButtonClick = useCallback((plan: PricingPlan) => {
        if (plan.isEnterprise) {
            alert("Veuillez nous contacter pour discuter de vos besoins spécifiques et obtenir un devis personnalisé.");
        } else {
            navigateTo('billing');
        }
    }, [navigateTo]);

    const FaqSection: React.FC = () => (
        <div className="faq-section">
            <h2 className="faq-title">Questions Fréquemment Posées</h2>
            <div className="faq-accordion">
                <details className="faq-item">
                    <summary className="faq-question">Qu'est-ce qu'un crédit et comment sont-ils utilisés ?</summary>
                    <div className="faq-answer">
                        <p>Les crédits sont l'unité que vous utilisez pour accéder aux fonctionnalités de l'IA. Par exemple, la génération d'un plan de contenu coûte 100 crédits, tandis que la rédaction d'un article ou une optimisation en coûte 20. Vos crédits sont renouvelés chaque mois.</p>
                    </div>
                </details>
                <details className="faq-item">
                    <summary className="faq-question">Puis-je changer de plan plus tard ?</summary>
                    <div className="faq-answer">
                        <p>Oui, vous pouvez mettre à niveau ou rétrograder votre plan à tout moment depuis votre page de facturation. Les modifications prendront effet lors de votre prochain cycle de facturation.</p>
                    </div>
                </details>
                <details className="faq-item">
                    <summary className="faq-question">L'abonnement annuel est-il remboursable ?</summary>
                    <div className="faq-answer">
                        <p>Nous n'offrons pas de remboursement pour les abonnements annuels après la période de rétractation légale. Vous pouvez annuler le renouvellement automatique à tout moment.</p>
                    </div>
                </details>
            </div>
        </div>
    );

    return (
        <div className="plans-pricing-page">
            <div className="page-header-actions">
                <div>
                    <h2 className="content-title">Plans et Tarifs</h2>
                    <p className="content-subtitle">Choisissez le plan qui correspond le mieux à vos ambitions.</p>
                </div>
            </div>

            <div className="billing-cycle-toggle">
                <button
                    className={`toggle-button ${billingCycle === 'monthly' ? 'active' : ''}`}
                    onClick={() => setBillingCycle('monthly')}
                >
                    Mensuel
                </button>
                <button
                    className={`toggle-button ${billingCycle === 'annual' ? 'active' : ''}`}
                    onClick={() => setBillingCycle('annual')}
                >
                    Annuel (Économisez 15%)
                </button>
            </div>

            <div className="pricing-plans-grid">
                {pricingPlans.map(plan => (
                    <div key={plan.id} className={`pricing-plan-card ${plan.bestValue ? 'best-value' : ''} plan-type-${plan.buttonType}`}>
                        {plan.bestValue && <div className="best-value-badge">Meilleur Choix</div>}
                        <h3>{plan.name}</h3>
                        <p className="plan-subtitle">{plan.priceSubtitle}</p>
                        <div className="plan-price">
                            {plan.isEnterprise ? (
                                <span className="enterprise-price">Sur Devis</span>
                            ) : (
                                <>
                                    {billingCycle === 'monthly' ? (
                                        <>
                                            <span className="price-amount">{plan.monthlyPrice}€</span>
                                            <span className="price-cycle">/mois</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="price-amount">{Math.round(plan.annualPrice / 12)}€</span>
                                            <span className="price-cycle">/mois</span>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                         <p className="annual-billing-note">
                            {billingCycle === 'annual' && !plan.isEnterprise && `Facturé ${plan.annualPrice}€ annuellement`}
                        </p>
                        
                        <button className="submit-button" onClick={() => handlePlanButtonClick(plan)}>
                            {plan.buttonText}
                        </button>
                        
                        <div className="plan-features">
                            {plan.featuresIntro && <p className="features-intro">{plan.featuresIntro}</p>}
                            <ul>
                                {plan.features.map((feature, index) => (
                                    <li key={index}>{feature}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
            
            <FaqSection />
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}