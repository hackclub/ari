<script lang="ts">
	import { submitAction } from '$lib/actions';
	import { toast } from '$lib/toast.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import ImageCropDialog from './ImageCropDialog.svelte';
	import TextField from './TextField.svelte';

	interface Props {
		value?: string;
		mode?: 'square' | 'wide';
		label: string;
		action?: string;
		actionUrl?: string;
		uploadsEnabled?: boolean;
		hint?: string;
	}
	let {
		value = $bindable(''),
		mode = 'square',
		label,
		action = 'uploadImage',
		actionUrl,
		uploadsEnabled = true,
		hint
	}: Props = $props();

	const uid = $props.id();
	let fileInput = $state<HTMLInputElement>();
	let pasting = $state(false);
	let urlDraft = $state('');
	let urlError = $state('');
	let draggedOver = $state(false);
	let cropOpen = $state(false);
	let image = $state<HTMLImageElement | null>(null);
	let objectUrl: string | null = null;

	const showUrlRow = $derived(pasting || !uploadsEnabled);

	function release() {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
		objectUrl = null;
		image = null;
	}

	// what the server stores; svg is text that can carry script, so it stays out
	const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'];

	function pickFile(file: File | null | undefined) {
		if (!file) return;
		if (!imageTypes.includes(file.type)) {
			toast.error('That file is not an image');
			return;
		}
		release();
		objectUrl = URL.createObjectURL(file);
		const loaded = new Image();
		loaded.onload = () => {
			image = loaded;
			cropOpen = true;
		};
		loaded.onerror = () => {
			toast.error('Could not read that image');
			release();
		};
		loaded.src = objectUrl;
	}

	async function upload(blob: Blob): Promise<boolean> {
		const body = new FormData();
		body.append('file', blob, mode === 'square' ? 'icon.png' : 'card.png');
		const result = await submitAction<{ url: string }>(action, body, {
			actionUrl,
			invalidate: false,
			errorToast: true,
			fallbackMessage: 'Upload failed'
		});
		if (!result.ok) return false;
		if (typeof result.data?.url !== 'string') {
			toast.error('Upload failed');
			return false;
		}
		value = result.data.url;
		toast.success('Image uploaded');
		return true;
	}

	function useUrl() {
		const candidate = urlDraft.trim();
		if (!/^https?:\/\//i.test(candidate)) {
			urlError = 'Enter a URL starting with http:// or https://';
			return;
		}
		value = candidate;
		urlDraft = '';
		urlError = '';
		pasting = false;
	}

	function urlKey(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			useUrl();
		} else if (event.key === 'Escape' && uploadsEnabled) {
			pasting = false;
		}
	}
</script>

<div class="imageUpload">
	<input
		bind:this={fileInput}
		class="file"
		type="file"
		accept={imageTypes.join(',')}
		tabindex="-1"
		aria-hidden="true"
		onchange={(event) => {
			pickFile(event.currentTarget.files?.[0]);
			event.currentTarget.value = '';
		}}
	/>

	{#if value}
		<div class="filled">
			<img class={['preview', mode]} src={value} alt="" referrerpolicy="no-referrer" />
			<div class="details">
				<span class="url" title={value}>{value}</span>
				<div class="buttons">
					{#if uploadsEnabled}
						<Button size="sm" icon="upload" onclick={() => fileInput?.click()}>Replace</Button>
					{/if}
					<Button
						size="sm"
						variant="quiet"
						aria-label={`Remove ${label}`}
						onclick={() => (value = '')}
					>
						Remove
					</Button>
				</div>
			</div>
		</div>
	{:else}
		{#if uploadsEnabled && !pasting}
			<button
				type="button"
				class={['drop', draggedOver && 'over']}
				aria-label={`Upload ${label}`}
				onclick={() => fileInput?.click()}
				ondragover={(event) => {
					event.preventDefault();
					draggedOver = true;
				}}
				ondragleave={() => (draggedOver = false)}
				ondrop={(event) => {
					event.preventDefault();
					draggedOver = false;
					pickFile(event.dataTransfer?.files?.[0]);
				}}
			>
				<Icon name="image" size={22} />
				<span class="dropText">
					<span class="lead">Drop an image or click to upload</span>
					<span class="sub">
						{hint ??
							(mode === 'square' ? 'Square works best' : 'Wide image, drawn on the card edge')}
					</span>
				</span>
			</button>
			<div>
				<Button size="sm" variant="quiet" icon="link" onclick={() => (pasting = true)}>
					Paste a URL instead
				</Button>
			</div>
		{/if}
		{#if showUrlRow}
			<div class="urlRow">
				<div class="urlField">
					<TextField
						label="Image URL"
						name={`${uid}Url`}
						placeholder="https://…"
						error={urlError || null}
						bind:value={urlDraft}
						onkeydown={urlKey}
					/>
				</div>
				<Button size="sm" disabled={!urlDraft.trim()} onclick={useUrl}>Use URL</Button>
				{#if uploadsEnabled}
					<Button size="sm" variant="quiet" onclick={() => (pasting = false)}>Cancel</Button>
				{/if}
			</div>
			{#if !uploadsEnabled}
				<p class="note">
					Image uploads are not configured on this deployment. Paste an image URL instead.
				</p>
			{/if}
		{/if}
	{/if}
</div>

<ImageCropDialog bind:open={cropOpen} {image} {mode} {label} onApply={upload} onClose={release} />

<style>
	.imageUpload {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	.file {
		display: none;
	}
	.filled {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-width: 0;
	}
	.preview {
		flex: 0 0 auto;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-2);
		object-fit: cover;
	}
	.preview.square {
		width: 48px;
		height: 48px;
	}
	.preview.wide {
		width: 96px;
		/* 16:9: 96 * 9 / 16 */
		height: 54px;
	}
	.details {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	.url {
		overflow: hidden;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-3);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.buttons {
		display: flex;
		gap: var(--space-2);
	}
	.drop {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-3) var(--space-4);
		border: 1.5px dashed var(--border-2);
		border-radius: var(--radius-md);
		background: var(--surface-2);
		color: var(--text-2);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 0.12s,
			background 0.12s,
			color 0.12s;
	}
	.drop:hover,
	.drop.over {
		border-color: var(--primary);
		background: var(--primary-soft);
		color: var(--primary);
	}
	.drop:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}
	.dropText {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.lead {
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.sub {
		font-size: var(--text-xs);
		color: var(--text-3);
	}
	.urlRow {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-2);
	}
	.urlField {
		flex: 1;
		min-width: 200px;
	}
	.note {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--text-2);
	}
</style>
