<script module lang="ts">
  export type Weekday =
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";

  export const secondsPerDay = 24 * 60 * 60;

  export const weekdays: { value: Weekday; label: string }[] = [
    { value: "monday", label: "Monday" },
    { value: "tuesday", label: "Tuesday" },
    { value: "wednesday", label: "Wednesday" },
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
    { value: "saturday", label: "Saturday" },
    { value: "sunday", label: "Sunday" },
  ];

  export const weekdayIndex: Record<Weekday, number> = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  };
</script>

<script lang="ts">
  let {
    day = $bindable<Weekday>("monday"),
    time = $bindable("08:00"),
  }: {
    day: Weekday;
    time: string;
  } = $props();
</script>

<div class="time-picker">
  <label>
    <span>Day</span>
    <select bind:value={day}>
      {#each weekdays as weekday}
        <option value={weekday.value}>{weekday.label}</option>
      {/each}
    </select>
  </label>
  <label>
    <span>Time</span>
    <input type="time" bind:value={time} />
  </label>
</div>

<style>
  .time-picker {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 130px;
    text-align: left;
    color: var(--text-h);
    font-size: 14px;
    line-height: 1.2;
  }

  select,
  input {
    box-sizing: border-box;
    min-height: 38px;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.45rem 0.5rem;
    color: var(--text-h);
    background: var(--bg);
    font: inherit;
  }
</style>
