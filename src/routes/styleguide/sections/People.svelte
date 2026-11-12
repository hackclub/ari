<script lang="ts">
	import { Avatar, AvatarStack, Card } from '$lib/components/ui';

	const sizes = ['sm', 'md', 'lg'] as const;
	const portrait = `data:image/svg+xml,${encodeURIComponent(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="teal"/><circle cx="32" cy="26" r="12" fill="white"/><circle cx="32" cy="66" r="24" fill="white"/></svg>'
	)}`;
	const reviewers = [
		{ name: 'User 1', color: '#338eda' },
		{ name: 'User 2', color: '#f1c40f' },
		{ name: 'User 3', color: '#33d6a6' },
		{ name: 'User 4', color: '#a633d6' },
		{ name: 'User 5', color: '#ff8c37' },
		{ name: 'User 6' }
	];
</script>

<h2>People</h2>
<Card>
	<div class="stack">
		<h3>Avatar</h3>
		<div class="row">
			{#each sizes as size (size)}
				<Avatar name="User 1" color="#338eda" {size} />
			{/each}
			{#each sizes as size (size)}
				<Avatar name="User 2" src={portrait} {size} />
			{/each}
			<Avatar name="Light Swatch" color="#f1c40f" />
			<Avatar name="Default Colour" />
			<Avatar name="Broken Image" src="/styleguide/missingAvatar.png" color="#a633d6" />
		</div>
		<h3>AvatarStack</h3>
		<div class="row">
			{#each sizes as size (size)}
				<AvatarStack people={reviewers} {size} />
			{/each}
			<AvatarStack people={reviewers.slice(0, 2)} />
		</div>
	</div>
</Card>

<style>
	h2 {
		margin: 0 0 var(--space-3);
		font-size: var(--text-lg);
		font-weight: 600;
	}
	h3 {
		margin: 0;
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--text-2);
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
</style>
