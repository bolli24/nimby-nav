<script lang="ts" generics="T">
	type DropdownChoice<T> = {
		value: T;
		label: string;
	};

	let {
		value = $bindable<T | null>(null),
		choices,
		placeholder = "",
	}: {
		value: T | null;
		choices: DropdownChoice<T>[];
		placeholder: string;
	} = $props();
	let open = $state(false);
	let query = $state("");
	let lowerCaseChoices = $derived(
		choices.map((choice) => ({
			choice,
			labelLowercase: choice.label.toLocaleLowerCase(),
		})),
	);
	let highlighted = $state(0);
	let queryLowercase = $derived(query.toLocaleLowerCase().trimStart());
	let options: DropdownChoice<T>[] = $derived(
		lowerCaseChoices
			.filter((entry) => entry.labelLowercase.startsWith(queryLowercase))
			.map((entry) => entry.choice)
			.slice(0, 5),
	);

	const choose = (option: DropdownChoice<T>): void => {
		value = option.value;
		query = option.label;
		open = false;
		highlighted = 0;
	};

	const handleInput = (): void => {
		value = null;
		open = true;
		highlighted = 0;
	};

	const handleKeydown = (event: KeyboardEvent): void => {
		if (!open || options.length === 0) return;

		if (event.key === "ArrowDown") {
			event.preventDefault();
			highlighted = (highlighted + 1) % options.length;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			highlighted = (highlighted - 1 + options.length) % options.length;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			choose(options[highlighted]);
		}

		if (event.key === "Escape") {
			open = false;
		}
	};
</script>

<div class="autocomplete">
	<input
		type="text"
		bind:value={query}
		onfocus={() => (open = true)}
		oninput={handleInput}
		onkeydown={handleKeydown}
		role="combobox"
		aria-expanded={open}
		aria-autocomplete="list"
		aria-controls="dropdown"
		{placeholder}
	/>
	{#if open && options.length > 0}
		<ul class="dropdown" role="listbox">
			{#each options as option, i}
				<li
					role="option"
					aria-selected={i === highlighted}
					class:highlighted={i === highlighted}
					onmousedown={() => choose(option)}
				>
					{option.label}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.autocomplete {
		position: relative;
		width: 250px;
	}

	input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.5rem;
	}

	.dropdown {
		position: absolute;
		z-index: 10;
		width: 100%;
		margin: 0;
		padding: 0;
		list-style: none;
		border: 1px solid #ccc;
		background: white;
		max-height: 200px;
		overflow-y: auto;
	}

	li {
		padding: 0.5rem;
		cursor: pointer;
	}

	li.highlighted,
	li:hover {
		background: #eee;
	}
</style>
