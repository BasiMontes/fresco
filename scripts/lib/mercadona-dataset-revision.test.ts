import { describe, expect, test } from 'bun:test';
import { datasetBase, datasetRevision, datasetTreeUrl, isCommitSha, REVISION_ENV } from './mercadona-dataset-revision';

const SHA = 'fa9daa732908cdae9868aa48ebec94a30cbdf617';

describe('isCommitSha', () => {
  test('accepts a full lowercase SHA', () => {
    expect(isCommitSha(SHA)).toBe(true);
  });

  test.each(['main', 'v1', 'fa9daa7', SHA.toUpperCase(), `${SHA}0`, SHA.slice(1), '', ' '.repeat(40)])('rejects %p', (value) => {
    expect(isCommitSha(value)).toBe(false);
  });

  test('rejects a value that is not a string', () => {
    expect(isCommitSha(undefined)).toBe(false);
    expect(isCommitSha(null)).toBe(false);
    expect(isCommitSha(123)).toBe(false);
  });
});

describe('datasetRevision', () => {
  test('reads main when no revision is set, as a local run does', () => {
    expect(datasetRevision({})).toBe('main');
    expect(datasetRevision({ [REVISION_ENV]: '' })).toBe('main');
  });

  test('uses the pinned SHA when it is set', () => {
    expect(datasetRevision({ [REVISION_ENV]: SHA })).toBe(SHA);
  });

  test('fails closed on a value that is set but is not a full SHA', () => {
    expect(() => datasetRevision({ [REVISION_ENV]: 'main' })).toThrow(REVISION_ENV);
    expect(() => datasetRevision({ [REVISION_ENV]: 'fa9daa7' })).toThrow('40-character');
  });
});

describe('dataset urls', () => {
  test('the download base and the tree link carry the revision', () => {
    expect(datasetBase(SHA)).toBe(`https://huggingface.co/datasets/datania/mercadona-catalog/resolve/${SHA}`);
    expect(datasetTreeUrl(SHA)).toBe(`https://huggingface.co/datasets/datania/mercadona-catalog/tree/${SHA}`);
  });
});
