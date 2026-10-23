/**
 * Vitest-korvike `server-only`-paketille.
 *
 * Sovelluksen palvelinmoduulit on suojattu `server-only`-importilla, jotta
 * vastausavain ei voi päätyä selainpakettiin. Vitestissä ajetaan Node-
 * ympäristössä, joten alkuperäinen moduuli heittäisi virheen. Tämä tyhjä
 * moduuli sallii palvelinpuolen logiikan testaamisen.
 */
export {};
