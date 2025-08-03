/**
 * Basic NetScript Type Definitions
 * For Bitburner
 */

interface Multipliers {
    HackingLevel: number;
    ServerMaxMoney: number;
    CompanyRepGain: number;
    CrimeSuccessRate: number;
    HacknetNodeMoney: number;
    CorporationValuation: number;
    BladeburnerRank: number;
}

interface BitNodeMultipliers {
    HackingLevel: number;
    ServerMaxMoney: number;
    CompanyRepGain: number;
    CrimeSuccessRate: number;
    HacknetNodeMoney: number;
    CorporationValuation: number;
    BladeburnerRank: number;
}

// Extend the existing NS interface
declare interface NS {
    // Core methods
    hack(host: string): Promise<number>;
    grow(host: string): Promise<number>;
    weaken(host: string): Promise<number>;
    sleep(ms: number): Promise<void>;

    // Server information methods
    scan(host: string): string[];
    hasRootAccess(host: string): boolean;
    getServerRequiredHackingLevel(host: string): number;
    getServerMaxMoney(host: string): number;
    getServerMoneyAvailable(host: string): number;
    getServerSecurityLevel(host: string): number;
    getServerMinSecurityLevel(host: string): number;
    getServerMaxRam(host: string): number;
    getServerUsedRam(host: string): number;
    getServerGrowth(host: string): number;
    getServer(host: string): Server;
    serverExists(hostname: string): boolean;

    // Hacking analysis methods
    hackAnalyze(host: string): number;
    hackAnalyzeThreads(host: string, hackAmount: number): number;
    hackAnalyzeChance(host: string): number;
    getHackTime(host: string): number;
    weakenAnalyze(threads: number): number;
    growthAnalyze(host: string, growthAmount: number): number;

    // File operations
    read(filename: string): string;
    write(filename: string, data: string, mode?: "w" | "a"): void;
    rm(filename: string, host: string): boolean;
    ls(host: string): string[];
    scp(files: string | string[], destination: string, source?: string): boolean;
    fileExists(filename: string, host: string): boolean;

    // Process management
    getScriptRam(script: string): number;
    exec(script: string, host: string, threads?: number, ...args: string[]): number;
    kill(pid: number | string, host?: string, args?: string[]): boolean;
    ps(host: string): ProcessInfo[];
    killall(host: string): boolean;  // Add this method
    deleteServer(host: string): boolean;  // Add this method

    // Utility methods
    tprint(msg: string): void;
    tprintf(format: string, ...args: any[]): void;  // Add this line
    print(msg: string): void;
    getHostname(): string;
    getHackingLevel(): number;
    flags(schema: [string, any][]): { [key: string]: any };

    // Game state methods
    getMultipliers(): Multipliers;
    getBitNodeMultipliers(): BitNodeMultipliers;
    getPlayer(): Player;
}

interface Player {
    bitNodeN: number;
    sourceFiles: SourceFile[];
    // Add other player properties as needed
}

interface SourceFile {
    n: number;
    lvl: number;
}

interface Server {
    name: string;
    maxRam: number;
    threads?: number;  // Made optional since it seems to be added programmatically
    hostname?: string;
    hasAdminRights?: boolean;
    moneyMax?: number;
    moneyAvailable?: number;
    hackDifficulty?: number;
    minDifficulty?: number;
    numOpenPortsRequired?: number;
    requiredHackingSkill?: number;
}

declare interface Window {
    ns: NS;
}

interface ProcessInfo {
    pid: number;
    filename: string;
}
