// src/utils/delay.ts

/**
 * Returns a promise that resolves after `ms` milliseconds.
 */
export const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Returns a random integer between min and max (inclusive).
 */
export const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};