import { describe, expect, it } from 'vitest';
import { dataUrlBytes, fitWithin, qualitySteps } from './photos.ts';

describe('fitWithin', () => {
  it('scales a wide picture down to the maximum width', () => {
    expect(fitWithin(4000, 3000, 1280)).toEqual({ width: 1280, height: 960 });
  });

  it('keeps the aspect ratio of a tall picture', () => {
    expect(fitWithin(3024, 4032, 400)).toEqual({ width: 400, height: 533 });
  });

  it('never upscales a small picture', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
  });

  it('keeps at least one pixel of height', () => {
    expect(fitWithin(10000, 1, 400)).toEqual({ width: 400, height: 1 });
  });
});

describe('dataUrlBytes', () => {
  it('counts decoded bytes without padding', () => {
    expect(dataUrlBytes('data:image/png;base64,QUJD')).toBe(3);
  });

  it('subtracts one padding character', () => {
    expect(dataUrlBytes('data:image/png;base64,QUI=')).toBe(2);
  });

  it('subtracts two padding characters', () => {
    expect(dataUrlBytes('data:image/png;base64,QQ==')).toBe(1);
  });

  it('matches the size of a real buffer', () => {
    const bytes = new Uint8Array(1000).fill(7);
    const base64 = btoa(String.fromCharCode(...bytes));
    expect(dataUrlBytes(`data:image/jpeg;base64,${base64}`)).toBe(1000);
  });
});

describe('qualitySteps', () => {
  it('lowers the JPEG quality from 0.8 to 0.4', () => {
    expect(qualitySteps()).toEqual([0.8, 0.7, 0.6, 0.5, 0.4]);
  });
});
