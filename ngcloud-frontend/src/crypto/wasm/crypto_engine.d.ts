/* tslint:disable */
/* eslint-disable */

export class EncapResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly ciphertext: Uint8Array;
    readonly shared_secret: Uint8Array;
}

export class KeyPair {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly private_key: Uint8Array;
    readonly public_key: Uint8Array;
}

/**
 * Opaque handle returned by kt_qhf_init.
 * The JS side holds this as an object and passes it back to update/finalize.
 */
export class KtQhfHandle {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Consume the handle and return the final 32-byte digest.
     * Produces the same result as kt_qhf_hash(full_message).
     */
    finalize(): Uint8Array;
    /**
     * Feed one chunk of plaintext into the running hash state.
     */
    update(chunk: Uint8Array): void;
}

export function argon2id_derive_key(password: Uint8Array, salt: Uint8Array): Uint8Array;

export function ascon_128a_decrypt(key: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array, ad: Uint8Array): Uint8Array;

export function ascon_128a_encrypt(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, ad: Uint8Array): Uint8Array;

export function decrypt_chunk(cipher: Uint8Array, file_key: Uint8Array, nonce: Uint8Array): Uint8Array;

export function derive_chunk_nonce(file_nonce: Uint8Array, chunk_index: number): Uint8Array;

export function encrypt_chunk(plain: Uint8Array, file_key: Uint8Array, nonce: Uint8Array): Uint8Array;

export function generate_file_key(): Uint8Array;

export function generate_nonce(): Uint8Array;

export function kt_qhf_hash(message: Uint8Array): Uint8Array;

/**
 * Create a new streaming KT-QHF hasher.
 */
export function kt_qhf_init(): KtQhfHandle;

export function mlkem768_decap(ciphertext: Uint8Array, private_key: Uint8Array): Uint8Array;

export function mlkem768_encap(public_key: Uint8Array): EncapResult;

export function mlkem768_keygen(): KeyPair;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_encapresult_free: (a: number, b: number) => void;
    readonly __wbg_keypair_free: (a: number, b: number) => void;
    readonly __wbg_ktqhfhandle_free: (a: number, b: number) => void;
    readonly argon2id_derive_key: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly ascon_128a_decrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
    readonly ascon_128a_encrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
    readonly decrypt_chunk: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly derive_chunk_nonce: (a: number, b: number, c: number) => [number, number];
    readonly encapresult_ciphertext: (a: number) => [number, number];
    readonly encapresult_shared_secret: (a: number) => [number, number];
    readonly generate_file_key: () => [number, number, number, number];
    readonly generate_nonce: () => [number, number, number, number];
    readonly keypair_private_key: (a: number) => [number, number];
    readonly keypair_public_key: (a: number) => [number, number];
    readonly kt_qhf_hash: (a: number, b: number) => [number, number];
    readonly kt_qhf_init: () => number;
    readonly ktqhfhandle_finalize: (a: number) => [number, number];
    readonly ktqhfhandle_update: (a: number, b: number, c: number) => void;
    readonly mlkem768_decap: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly mlkem768_encap: (a: number, b: number) => [number, number, number];
    readonly mlkem768_keygen: () => number;
    readonly encrypt_chunk: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
