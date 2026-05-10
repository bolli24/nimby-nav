<script lang="ts">
  import DepartureTimePicker, { type Weekday } from "./lib/TimePicker.svelte";
  import Dropdown from "./lib/Dropdown.svelte";

  type LonLat = { lon: number; lat: number };
  type Id = string;
  type ShiftId = string;

  type StationId = `0x2${string}`;
  type LineId = `0x4${string}`;
  type TrainId = `0x5${string}`;
  type ScheduleId = `0x6${string}`;

  type Color = string;
  type ExportMeta = {
    class: "ExportMeta";
    company_name: string;
    clock_epoch_s: number;
    model_version: number;
  };
  type Station = {
    class: "Station";
    id: StationId;
    name: string;
    pos: LonLat;
    tags: Id[];
  };
  type Line = {
    class: "Line";
    id: LineId;
    name: string;
    code: string;
    color: Color;
    tags: Id[];
    stops: Stop[];
  };
  type Stop = {
    class: "Stop";
    idx: 0;
    leg_distance: number;
    station_id: StationId;
    arrival: 0;
    departure: 20;
    areas: unknown[];
  };
  type Train = {
    class: "Train";
    id: TrainId;
    name: string;
    code: string;
    tags: Id[];
  };
  type Schedule = {
    class: "Schedule";
    id: ScheduleId;
    name: string;
    color: Color;
    tz_delta_s: number;
    tags: Id[];
    trains: Record<TrainId, ShiftId[]>;
    shifts: Shift[];
  };
  type Shift = {
    class: "Shift";
    id: ShiftId;
    name: string;
    tags: Id[];
    runs: Run[];
  };
  type Run = {
    class: "Run";
    idx: number;
    line_id: LineId;
    enter_stop_idx: number;
    exit_stop_idx: number;
    arrival_departure: number[];
  };
  type ExportMember = { class: string };
  type Export = ExportMember[];

  type Connection = {
    origin: StationId;
    destination: StationId;
    arrival: number;
    departure: number;
    lineId: LineId;
    line_origin_idx: number;
    line_destination_idx: number;
    shiftId: ShiftId;
    runIdx: number;
  };

  const getConnections = (): Connection[] => {
    let connections: Connection[] = [];

    for (const [_, schedule] of schedules) {
      for (const shift of schedule.shifts) {
        for (const run of shift.runs) {
          let line: Line = lines.get(run.line_id)!;
          for (let i = 0; i < run.arrival_departure.length / 2; i++) {
            let arrival = run.arrival_departure[2 * i];
            let departure = run.arrival_departure[2 * i + 1];
            let origin_idx = (run.enter_stop_idx + i) % line.stops.length;
            let destination_idx =
              (run.enter_stop_idx + i + 1) % line.stops.length;
            let connection: Connection = {
              origin: line.stops[origin_idx].station_id,
              destination: line.stops[destination_idx].station_id,
              arrival,
              departure,
              lineId: run.line_id,
              line_origin_idx: origin_idx,
              line_destination_idx: destination_idx,
              shiftId: shift.id,
              runIdx: run.idx,
            };
            connections.push(connection);
          }
        }
      }
    }

    return connections;
  };

  const findRoute = (
    origin: StationId,
    destionation: StationId,
    departure: number,
  ): Connection[] | null => {
    


    return null;
  };

  function isExportMeta(member: ExportMember): member is ExportMeta {
    return member.class === "ExportMeta";
  }

  function isStation(member: ExportMember): member is Station {
    return member.class === "Station";
  }

  function isLine(member: ExportMember): member is Line {
    return member.class === "Line";
  }

  function isTrain(member: ExportMember): member is Train {
    return member.class === "Train";
  }

  function isSchedule(member: ExportMember): member is Schedule {
    return member.class === "Schedule";
  }

  function getExportMeta(data: Export): ExportMeta {
    const meta = data.find(isExportMeta);

    if (!meta) {
      throw new Error("ExportMeta missing from export");
    }

    return meta;
  }

  let files: FileList | null = $state(null);
  let data = $state<Export>([]);
  let meta = $derived(data.length === 0 ? null : getExportMeta(data));
  let fromStationId = $state<StationId | null>(null);
  let toStationId = $state<StationId | null>(null);
  let departureDay = $state<Weekday>("monday");
  let departureTime = $state("08:00");
  let stations = $derived(
    new Map(data.filter(isStation).map((station) => [station.id, station])),
  );
  let stationChoices = $derived(
    Array.from(stations.values()).map((station) => ({
      value: station.id,
      label: station.name,
    })),
  );
  let lines = $derived(
    new Map(data.filter(isLine).map((line) => [line.id, line])),
  );
  let trains = $derived(
    new Map(data.filter(isTrain).map((train) => [train.id, train])),
  );
  let schedules = $derived(
    new Map(data.filter(isSchedule).map((schedule) => [schedule.id, schedule])),
  );

  let connections = $derived(getConnections());

  if (import.meta.env.DEV) {
    fetch("/Short%20Engineering%20Timetable%20Export%2020250928T000711Z.json")
      .then((response) => response.json())
      .then((json: Export) => {
        data = json;
      });
  }

  async function readSelectedFile(fileList: FileList | null) {
    const file = fileList?.item(0);

    if (!file) {
      data = [];
      return;
    }

    data = JSON.parse(await file.text());
  }
</script>

<section id="center">
  <input
    type="file"
    accept="application/json,.json"
    bind:files
    onchange={(event) => readSelectedFile(event.currentTarget.files)}
  />
  <div>{meta?.company_name}</div>
  <div class="route-inputs">
    <Dropdown
      bind:value={fromStationId}
      choices={stationChoices}
      placeholder="From"
    />
    <Dropdown
      bind:value={toStationId}
      choices={stationChoices}
      placeholder="To"
    />
    <DepartureTimePicker bind:day={departureDay} bind:time={departureTime} />
  </div>

  <p>Indexed {connections.length} connections.</p>

  <ol>
    {#each stations.values() as station}
      <li>{station.name}</li>
    {/each}
  </ol>

  <ol>
    {#each lines.values() as line}
      <li>{line.name}</li>
    {/each}
  </ol>

  <ol>
    {#each trains.values() as train}
      <li>{train.name}</li>
    {/each}
  </ol>
</section>

<style>
  .route-inputs {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    flex-wrap: wrap;
    justify-content: center;
  }
</style>
