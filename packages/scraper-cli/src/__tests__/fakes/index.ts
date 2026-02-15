/**
 * Fake implementations of injectable dependencies for testing.
 *
 * These fakes enable unit and integration tests to exercise UploadService
 * logic without real filesystem, network, or clock dependencies.
 *
 * Requirements: 8.4
 */

import { type Dirent } from 'fs'
import { Readable } from 'stream'
import type {
  FileSystem,
  Hasher,
  BucketClient,
  Clock,
  ProgressReporter,
} from '../../services/UploadService.js'
import * as crypto from 'crypto'

// ─── FakeFileSystem ──────────────────────────────────────────────────────────

interface FakeFileEntry {
  content: Buffer
  mtimeMs: number
}

interface FakeDirEntry {
  children: Map<string, FakeNode>
}

type FakeNode =
  | { type: 'file'; entry: FakeFileEntry }
  | { type: 'directory'; entry: FakeDirEntry }

/**
 * In-memory filesystem fake for testing.
 * Supports readdir, stat, readFile, writeFile, rename, and access.
 */
export class FakeFileSystem implements FileSystem {
  private readonly root: Map<string, FakeNode> = new Map()

  /** Track writeFile calls for assertion (path -> call count) */
  readonly writeFileCalls: Array<{ path: string; data: string }> = []

  /** Optional: make specific writeFile calls fail */
  private writeFileFailures: Map<string, { remaining: number }> = new Map()

  /**
   * Add a file to the in-memory tree.
   * Automatically creates parent directories.
   */
  addFile(filePath: string, content: string, mtimeMs?: number): void {
    const normalised = this.normalisePath(filePath)
    const parts = normalised.split('/')
    const fileName = parts.pop()!
    this.ensureDirectories(parts)

    const dir = this.getDirectory(parts)
    dir.children.set(fileName, {
      type: 'file',
      entry: {
        content: Buffer.from(content),
        mtimeMs: mtimeMs ?? Date.now(),
      },
    })
  }

  /**
   * Add a directory to the in-memory tree.
   */
  addDirectory(dirPath: string): void {
    const normalised = this.normalisePath(dirPath)
    const parts = normalised.split('/')
    this.ensureDirectories(parts)
  }

  /**
   * Configure writeFile to fail for a specific path.
   * @param path - The file path that should fail
   * @param times - Number of times to fail (then succeed)
   */
  setWriteFileFailure(path: string, times: number): void {
    this.writeFileFailures.set(this.normalisePath(path), { remaining: times })
  }

  async readdir(
    dirPath: string,
    _options: { withFileTypes: true }
  ): Promise<Dirent[]> {
    const normalised = this.normalisePath(dirPath)
    const parts = normalised.split('/')
    const dir = this.tryGetDirectory(parts)

    if (!dir) {
      const err = new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }

    const entries: Dirent[] = []
    for (const [name, node] of dir.children) {
      entries.push(this.createDirent(name, node.type === 'directory'))
    }
    return entries
  }

  async stat(filePath: string): Promise<{ size: number; mtimeMs: number }> {
    const normalised = this.normalisePath(filePath)
    const parts = normalised.split('/')
    const node = this.getNode(parts)

    if (!node) {
      const err = new Error(`ENOENT: no such file or directory, stat '${filePath}'`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }

    if (node.type === 'file') {
      return { size: node.entry.content.length, mtimeMs: node.entry.mtimeMs }
    }
    return { size: 0, mtimeMs: 0 }
  }

  async readFile(filePath: string): Promise<Buffer> {
    const normalised = this.normalisePath(filePath)
    const parts = normalised.split('/')
    const node = this.getNode(parts)

    if (!node || node.type !== 'file') {
      const err = new Error(`ENOENT: no such file or directory, open '${filePath}'`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }

    return Buffer.from(node.entry.content)
  }

  async writeFile(filePath: string, data: string): Promise<void> {
    this.writeFileCalls.push({ path: filePath, data })

    // Check for configured failures
    const normalised = this.normalisePath(filePath)
    const failure = this.writeFileFailures.get(normalised)
    if (failure && failure.remaining > 0) {
      failure.remaining--
      throw new Error(`EACCES: permission denied, open '${filePath}'`)
    }

    const parts = normalised.split('/')
    const fileName = parts.pop()!
    this.ensureDirectories(parts)

    const dir = this.getDirectory(parts)
    dir.children.set(fileName, {
      type: 'file',
      entry: {
        content: Buffer.from(data),
        mtimeMs: Date.now(),
      },
    })
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const oldNorm = this.normalisePath(oldPath)
    const newNorm = this.normalisePath(newPath)

    const oldParts = oldNorm.split('/')
    const oldName = oldParts.pop()!
    const oldDir = this.tryGetDirectory(oldParts)

    if (!oldDir || !oldDir.children.has(oldName)) {
      const err = new Error(`ENOENT: no such file or directory, rename '${oldPath}'`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }

    const node = oldDir.children.get(oldName)!
    oldDir.children.delete(oldName)

    const newParts = newNorm.split('/')
    const newName = newParts.pop()!
    this.ensureDirectories(newParts)
    const newDir = this.getDirectory(newParts)
    newDir.children.set(newName, node)
  }

  async access(filePath: string): Promise<void> {
    const normalised = this.normalisePath(filePath)
    const parts = normalised.split('/')
    const node = this.getNode(parts)

    if (!node) {
      const err = new Error(`ENOENT: no such file or directory, access '${filePath}'`) as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    }
  }

  /**
   * Update the mtime of an existing file (for testing incremental changes).
   */
  updateFileMtime(filePath: string, mtimeMs: number): void {
    const normalised = this.normalisePath(filePath)
    const parts = normalised.split('/')
    const node = this.getNode(parts)
    if (node && node.type === 'file') {
      node.entry.mtimeMs = mtimeMs
    }
  }

  /**
   * Update the content of an existing file (for testing incremental changes).
   */
  updateFileContent(filePath: string, content: string, mtimeMs?: number): void {
    const normalised = this.normalisePath(filePath)
    const parts = normalised.split('/')
    const node = this.getNode(parts)
    if (node && node.type === 'file') {
      node.entry.content = Buffer.from(content)
      if (mtimeMs !== undefined) {
        node.entry.mtimeMs = mtimeMs
      }
    }
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private normalisePath(p: string): string {
    // Strip leading slash for consistent internal representation
    return p.replace(/^\/+/, '').replace(/\/+$/, '')
  }

  private ensureDirectories(parts: string[]): void {
    let current = this.root
    for (const part of parts) {
      if (!part) continue
      let node = current.get(part)
      if (!node) {
        node = { type: 'directory', entry: { children: new Map() } }
        current.set(part, node)
      }
      if (node.type !== 'directory') {
        throw new Error(`Path component '${part}' is not a directory`)
      }
      current = node.entry.children
    }
  }

  private getDirectory(parts: string[]): FakeDirEntry {
    let current = this.root
    for (const part of parts) {
      if (!part) continue
      const node = current.get(part)
      if (!node || node.type !== 'directory') {
        throw new Error(`Directory not found: ${parts.join('/')}`)
      }
      current = node.entry.children
    }
    return { children: current }
  }

  private tryGetDirectory(parts: string[]): FakeDirEntry | null {
    let current = this.root
    for (const part of parts) {
      if (!part) continue
      const node = current.get(part)
      if (!node || node.type !== 'directory') {
        return null
      }
      current = node.entry.children
    }
    return { children: current }
  }

  private getNode(parts: string[]): FakeNode | null {
    let current = this.root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!
      if (!part) continue
      const node = current.get(part)
      if (!node) return null
      if (i === parts.length - 1) return node
      if (node.type !== 'directory') return null
      current = node.entry.children
    }
    // If we get here with an empty parts array, return the root as a directory
    return { type: 'directory', entry: { children: current } }
  }

  private createDirent(name: string, isDir: boolean): Dirent {
    // Create a minimal Dirent-like object for testing
    return {
      name,
      isFile: () => !isDir,
      isDirectory: () => isDir,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      path: '',
      parentPath: '',
    } as Dirent
  }
}

// ─── FakeHasher ──────────────────────────────────────────────────────────────

/**
 * Deterministic hasher fake for testing.
 * Returns a hash derived from the file path string for predictability.
 * Tracks calls for assertion.
 */
export class FakeHasher implements Hasher {
  /** All sha256 calls recorded for assertion */
  readonly calls: string[] = []

  async sha256(filePath: string): Promise<string> {
    this.calls.push(filePath)
    return crypto.createHash('sha256').update(filePath).digest('hex')
  }

  /** Get a deterministic hash for a given path (for test assertions) */
  static hashOf(filePath: string): string {
    return crypto.createHash('sha256').update(filePath).digest('hex')
  }
}

// ─── FakeBucketClient ────────────────────────────────────────────────────────

interface UploadStreamCall {
  remotePath: string
  contentType: string
  metadata: Record<string, string>
  body: Buffer
}

/**
 * Fake GCS bucket client for testing.
 * Records uploadStream calls and can simulate failures.
 * No `exists()` method — matches the BucketClient interface.
 */
export class FakeBucketClient implements BucketClient {
  /** All uploadStream calls recorded for assertion */
  readonly calls: UploadStreamCall[] = []

  /** Paths that should trigger failures when uploaded */
  private failures: Map<string, Error> = new Map()

  /**
   * Configure a specific remote path to fail on upload.
   */
  setFailure(remotePath: string, error: Error): void {
    this.failures.set(remotePath, error)
  }

  /**
   * Clear all configured failures.
   */
  clearFailures(): void {
    this.failures.clear()
  }

  async uploadStream(
    remotePath: string,
    stream: Readable,
    contentType: string,
    metadata: Record<string, string>
  ): Promise<void> {
    // Consume the stream to get the body
    const chunks: Buffer[] = []
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
    }
    const body = Buffer.concat(chunks)

    this.calls.push({ remotePath, contentType, metadata, body })

    const failure = this.failures.get(remotePath)
    if (failure) {
      throw failure
    }
  }
}

// ─── FakeClock ───────────────────────────────────────────────────────────────

/**
 * Fake clock for testing. Returns a fixed timestamp.
 */
export class FakeClock implements Clock {
  private timestamp: string

  constructor(fixedTimestamp: string = '2024-01-15T10:30:00.000Z') {
    this.timestamp = fixedTimestamp
  }

  now(): string {
    return this.timestamp
  }

  /** Update the fixed timestamp */
  setNow(timestamp: string): void {
    this.timestamp = timestamp
  }
}

// ─── FakeProgressReporter ────────────────────────────────────────────────────

interface DateCompleteCall {
  index: number
  total: number
  date: string
  fileCount: number
}

interface FileUploadedCall {
  remotePath: string
  status: 'uploaded' | 'skipped' | 'failed'
}

interface CompleteCall {
  uploaded: number
  skipped: number
  failed: number
  duration_ms: number
}

/**
 * Fake progress reporter for testing.
 * Captures all calls for assertion.
 */
export class FakeProgressReporter implements ProgressReporter {
  readonly dateCompleteCalls: DateCompleteCall[] = []
  readonly fileUploadedCalls: FileUploadedCall[] = []
  readonly completeCalls: CompleteCall[] = []

  onDateComplete(
    index: number,
    total: number,
    date: string,
    fileCount: number
  ): void {
    this.dateCompleteCalls.push({ index, total, date, fileCount })
  }

  onFileUploaded(
    remotePath: string,
    status: 'uploaded' | 'skipped' | 'failed'
  ): void {
    this.fileUploadedCalls.push({ remotePath, status })
  }

  onComplete(summary: {
    uploaded: number
    skipped: number
    failed: number
    duration_ms: number
  }): void {
    this.completeCalls.push(summary)
  }
}
