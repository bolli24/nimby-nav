<script lang="ts">
  import DepartureTimePicker, {
    secondsPerDay,
    type Weekday,
    weekdayIndex,
  } from "./lib/TimePicker.svelte";
  import Dropdown from "./lib/Dropdown.svelte";
  import { getOrInsertComputed } from "./lib/utils";

  type LonLat = [number, number];
  type Id = string;
  type ShiftId = string;

  type OperationalStationId = "0x0";
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
    lonlat: LonLat;
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
    station_id: StationId | OperationalStationId;
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

  type TrainConnection = {
    kind: "train";
    origin: StationId;
    destination: StationId;
    arrival: number;
    departure: number;
    lineId: LineId;
    line_origin_idx: number;
    line_destination_idx: number;
    shiftId: ShiftId;
    runIdx: number;
    continuationRunIdx?: number;
    tzDeltaSeconds: number;
  };

  type WalkConnection = {
    kind: "walk";
    origin: StationId;
    destination: StationId;
    distanceMeters: number;
    duration: number;
  };

  type Connection = TrainConnection | WalkConnection;

  const secondsPerWeek = secondsPerDay * 7;
  const earthRadiusMeters = 6371000;
  const walkingTransferRadiusMeters = 1000;
  const walkingTransferPenaltySeconds = 5 * 60;
  const walkingSpeedMetersPerSecond = 1.4;
  const walkingTimeCostMultiplier = 1.5;
  const operationalStationId: OperationalStationId = "0x0";

  const getConnections = (): Map<StationId, Connection[]> => {
    let connections = new Map<StationId, Connection[]>();

    if (meta === null) {
      return connections;
    }

    for (const [_, schedule] of schedules) {
      for (const shift of schedule.shifts) {
        for (const run of shift.runs) {
          let line: Line = lines.get(run.line_id)!;
          let stopCount = run.arrival_departure.length / 2;
          for (let i = 0; i < stopCount - 1; i++) {
            let departure = run.arrival_departure[2 * i + 1];
            let arrival = run.arrival_departure[2 * (i + 1)];
            let origin_idx = (run.enter_stop_idx + i) % line.stops.length;
            let destination_idx =
              (run.enter_stop_idx + i + 1) % line.stops.length;
            let origin = line.stops[origin_idx].station_id;
            let destination = line.stops[destination_idx].station_id;

            if (
              origin === operationalStationId ||
              destination === operationalStationId
            ) {
              continue;
            }

            let connection: TrainConnection = {
              kind: "train",
              origin,
              destination,
              arrival,
              departure,
              lineId: run.line_id,
              line_origin_idx: origin_idx,
              line_destination_idx: destination_idx,
              shiftId: shift.id,
              runIdx: run.idx,
              tzDeltaSeconds: schedule.tz_delta_s,
            };
            let stationConnections = getOrInsertComputed(
              connections,
              origin,
              () => [],
            );
            stationConnections.push(connection);
          }
        }

        for (let i = 1; i < shift.runs.length; i++) {
          let previousRun = shift.runs[i - 1];
          let nextRun = shift.runs[i];

          if (previousRun.line_id !== nextRun.line_id) {
            continue;
          }

          let line = lines.get(previousRun.line_id)!;
          let expectedNextStop =
            (previousRun.exit_stop_idx + 1) % line.stops.length;

          if (nextRun.enter_stop_idx !== expectedNextStop) {
            continue;
          }

          let origin = line.stops[previousRun.exit_stop_idx].station_id;
          let destination = line.stops[nextRun.enter_stop_idx].station_id;

          if (
            origin === operationalStationId ||
            destination === operationalStationId
          ) {
            continue;
          }

          getOrInsertComputed(connections, origin, () => []).push({
            kind: "train",
            origin,
            destination,
            departure: previousRun.arrival_departure.at(-1)!,
            arrival: nextRun.arrival_departure[0],
            lineId: previousRun.line_id,
            line_origin_idx: previousRun.exit_stop_idx,
            line_destination_idx: nextRun.enter_stop_idx,
            shiftId: shift.id,
            runIdx: previousRun.idx,
            continuationRunIdx: nextRun.idx,
            tzDeltaSeconds: schedule.tz_delta_s,
          });
        }
      }
    }

    for (const stationConnections of connections.values()) {
      stationConnections.sort((a, b) => {
        if (a.kind === "walk" || b.kind === "walk") {
          return 0;
        }

        return a.departure - b.departure;
      });
    }

    addWalkingConnections(connections);

    return connections;
  };

  function addWalkingConnections(connections: Map<StationId, Connection[]>) {
    let stationList = Array.from(stations.values());

    for (let i = 0; i < stationList.length; i++) {
      for (let j = i + 1; j < stationList.length; j++) {
        let first = stationList[i];
        let second = stationList[j];
        let distanceMeters = getDistanceMeters(first.lonlat, second.lonlat);

        if (distanceMeters > walkingTransferRadiusMeters) {
          continue;
        }

        let duration = Math.ceil(distanceMeters / walkingSpeedMetersPerSecond);
        addWalkingConnection(
          connections,
          first.id,
          second.id,
          distanceMeters,
          duration,
        );
        addWalkingConnection(
          connections,
          second.id,
          first.id,
          distanceMeters,
          duration,
        );
      }
    }
  }

  function addWalkingConnection(
    connections: Map<StationId, Connection[]>,
    origin: StationId,
    destination: StationId,
    distanceMeters: number,
    duration: number,
  ) {
    getOrInsertComputed(connections, origin, () => []).push({
      kind: "walk",
      origin,
      destination,
      distanceMeters,
      duration,
    });
  }

  function getDistanceMeters(first: LonLat, second: LonLat): number {
    let [firstLon, firstLat] = first;
    let [secondLon, secondLat] = second;
    let firstLatRadians = toRadians(firstLat);
    let secondLatRadians = toRadians(secondLat);
    let deltaLat = toRadians(secondLat - firstLat);
    let deltaLon = toRadians(secondLon - firstLon);
    let a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(firstLatRadians) *
        Math.cos(secondLatRadians) *
        Math.sin(deltaLon / 2) ** 2;

    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  const getNextConnectionTimes = (
    connection: TrainConnection,
    earliestDeparture: number,
  ): { departure: number; arrival: number } => {
    let duration = connection.arrival - connection.departure;
    if (duration < 0) {
      duration += secondsPerWeek;
    }

    let weekStart =
      Math.floor(earliestDeparture / secondsPerWeek) * secondsPerWeek;
    let departure = weekStart + connection.departure;

    if (departure < earliestDeparture) {
      departure += secondsPerWeek;
    }

    return {
      departure,
      arrival: departure + duration,
    };
  };

  const findRoute = (
    origin: StationId,
    destination: StationId,
    departure: number,
    includeWalkConnections: boolean,
  ): Connection[] | null => {
    let bestArrival = new Map<StationId, number>([[origin, departure]]);
    let previous = new Map<StationId, Connection>();
    let visited = new Set<StationId>();

    while (true) {
      let current: StationId | null = null;
      let currentTime = Infinity;

      for (const [station, time] of bestArrival) {
        if (!visited.has(station) && time < currentTime) {
          current = station;
          currentTime = time;
        }
      }

      if (current === null) {
        return null;
      }

      if (current === destination) {
        break;
      }

      visited.add(current);

      let stationConnections = connections.get(current) ?? [];
      let walkConnections = stationConnections.filter(
        (connection): connection is WalkConnection =>
          includeWalkConnections && connection.kind === "walk",
      );

      for (const connection of walkConnections) {
        let nextArrival =
          currentTime +
          walkingTransferPenaltySeconds +
          connection.duration * walkingTimeCostMultiplier;
        let knownArrival = bestArrival.get(connection.destination) ?? Infinity;

        if (nextArrival < knownArrival) {
          bestArrival.set(connection.destination, nextArrival);
          previous.set(connection.destination, connection);
        }
      }

      let trainConnections = stationConnections.filter(
        (connection): connection is TrainConnection =>
          connection.kind === "train",
      );
      let currentWeekTime = currentTime % secondsPerWeek;
      let firstConnection = trainConnections.findIndex(
        (connection) => connection.departure >= currentWeekTime,
      );

      for (let i = 0; i < trainConnections.length; i++) {
        let connectionIndex =
          firstConnection === -1
            ? i
            : (firstConnection + i) % trainConnections.length;
        let connection = trainConnections[connectionIndex];
        let nextTimes = getNextConnectionTimes(connection, currentTime);
        let knownArrival = bestArrival.get(connection.destination) ?? Infinity;

        if (nextTimes.arrival < knownArrival) {
          bestArrival.set(connection.destination, nextTimes.arrival);
          previous.set(connection.destination, connection);
        }
      }
    }

    let route: Connection[] = [];
    let station = destination;

    while (station !== origin) {
      let connection = previous.get(station);

      if (connection === undefined) {
        return null;
      }

      route.push(connection);
      station = connection.origin;
    }

    return route.reverse();
  };

  function collapseDisplayRoute(route: Connection[]): Connection[] {
    let displayRoute: Connection[] = [];

    for (const connection of route) {
      let previous = displayRoute.at(-1);

      if (
        previous?.kind === "train" &&
        connection.kind === "train" &&
        previous.lineId === connection.lineId &&
        previous.shiftId === connection.shiftId &&
        (previous.runIdx === connection.runIdx ||
          previous.continuationRunIdx === connection.runIdx) &&
        previous.destination === connection.origin
      ) {
        previous.destination = connection.destination;
        previous.arrival = connection.arrival;
        previous.line_destination_idx = connection.line_destination_idx;
        previous.runIdx = connection.continuationRunIdx ?? connection.runIdx;
        previous.continuationRunIdx = connection.continuationRunIdx;
        continue;
      }

      displayRoute.push({ ...connection });
    }

    return displayRoute;
  }

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

  function toSeconds(day: Weekday, time: string): number {
    const [hours = 0, minutes = 0] = time.split(":").map(Number);
    return weekdayIndex[day] * secondsPerDay + hours * 3600 + minutes * 60;
  }

  function toExportSecondsFromLocalWeek(
    localWeekSeconds: number,
    tzDeltaSeconds: number,
  ) {
    if (meta === null) {
      return localWeekSeconds;
    }

    let epochLocalWeekSeconds = getLocalWeekSeconds(
      meta.clock_epoch_s,
      tzDeltaSeconds,
    );
    let exportSeconds = localWeekSeconds - epochLocalWeekSeconds;

    if (exportSeconds < 0) {
      exportSeconds += secondsPerWeek;
    }

    return exportSeconds;
  }

  function getLocalWeekSeconds(
    unixSeconds: number,
    tzDeltaSeconds: number,
  ): number {
    let localDate = new Date((unixSeconds + tzDeltaSeconds) * 1000);
    let weekday = (localDate.getUTCDay() + 6) % 7;

    return (
      weekday * secondsPerDay +
      localDate.getUTCHours() * 3600 +
      localDate.getUTCMinutes() * 60 +
      localDate.getUTCSeconds()
    );
  }

  function formatTime(
    secondsFromEpoch: number,
    tzDeltaSeconds: number,
  ): string {
    let weekSeconds =
      meta === null
        ? ((secondsFromEpoch % secondsPerWeek) + secondsPerWeek) %
          secondsPerWeek
        : getLocalWeekSeconds(
            meta.clock_epoch_s + secondsFromEpoch,
            tzDeltaSeconds,
          );
    let daySeconds = weekSeconds % secondsPerDay;
    let hours = Math.floor(daySeconds / 3600);
    let minutes = Math.floor((daySeconds % 3600) / 60);

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
  }

  function formatDuration(seconds: number): string {
    let minutes = Math.max(1, Math.round(seconds / 60));

    return `${minutes} min`;
  }

  function getStationName(stationId: StationId): string {
    return stations.get(stationId)?.name ?? stationId;
  }

  function getLineName(lineId: LineId): string {
    let line = lines.get(lineId);

    if (line === undefined) {
      return lineId;
    }

    return line.name;
  }

  function getLineColor(lineId: LineId): string {
    let color = lines.get(lineId)?.color;

    if (color === undefined) {
      return "transparent";
    }

    if (/^0x[0-9a-fA-F]{8}$/.test(color)) {
      let blue = color.slice(4, 6);
      let green = color.slice(6, 8);
      let red = color.slice(8, 10);

      return `#${red}${green}${blue}`;
    }

    return color;
  }

  function getStationTzDeltaSeconds(stationId: StationId): number {
    for (const connection of connections.get(stationId) ?? []) {
      if (connection.kind === "train") {
        return connection.tzDeltaSeconds;
      }
    }

    for (const stationConnections of connections.values()) {
      for (const connection of stationConnections) {
        if (
          connection.kind === "train" &&
          connection.destination === stationId
        ) {
          return connection.tzDeltaSeconds;
        }
      }
    }

    return schedules.values().next().value?.tz_delta_s ?? 0;
  }

  let files: FileList | null = $state(null);
  let data = $state<Export>([]);
  let meta = $derived(data.length === 0 ? null : getExportMeta(data));
  let fromStationId = $state<StationId | null>(null);
  let toStationId = $state<StationId | null>(null);
  let departureDay = $state<Weekday>("monday");
  let departureTime = $state("08:00");
  let includeWalkLinks = $state(true);
  let route = $state<Connection[] | null>(null);
  let displayRoute = $derived(
    route === null ? null : collapseDisplayRoute(route),
  );
  let routeSearched = $state(false);
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
  let connectionCount = $derived.by(() => {
    let sum = 0;
    for (const c of connections.values()) {
      sum += c.length;
    }
    return sum;
  });

  if (import.meta.env.DEV) {
    fetch("/Short%20Engineering%20Timetable%20Export%2020250928T000711Z.json")
      .then((response) => response.json())
      .then((json: Export) => {
        data = json;
      });
  }

  function runRouting() {
    routeSearched = true;

    if (fromStationId === null || toStationId === null) {
      route = null;
      return;
    }

    let originTzDeltaSeconds = getStationTzDeltaSeconds(fromStationId);
    let departure = toExportSecondsFromLocalWeek(
      toSeconds(departureDay, departureTime),
      originTzDeltaSeconds,
    );

    route = findRoute(fromStationId, toStationId, departure, includeWalkLinks);
  }

  function rerunRoutingIfSearched() {
    if (!routeSearched) {
      return;
    }

    runRouting();
  }

  async function readSelectedFile(fileList: FileList | null) {
    const file = fileList?.item(0);

    if (!file) {
      data = [];
      route = null;
      routeSearched = false;
      return;
    }

    data = JSON.parse(await file.text());
    route = null;
    routeSearched = false;
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
    <label class="checkbox-control">
      <input
        type="checkbox"
        bind:checked={includeWalkLinks}
        onchange={rerunRoutingIfSearched}
      />
      <span>Walk links</span>
    </label>
    <button
      type="button"
      onclick={runRouting}
      disabled={fromStationId === null || toStationId === null}
    >
      Run route
    </button>
  </div>

  {#if displayRoute !== null && displayRoute.length > 0}
    <ol class="route-result">
      {#each displayRoute as connection}
        <li>
          {#if connection.kind === "train"}
            <strong>{getStationName(connection.origin)}</strong>
            <span>
              {formatTime(connection.departure, connection.tzDeltaSeconds)}
            </span>
            <span class="line-label">
              <span
                class="line-color"
                style:background-color={getLineColor(connection.lineId)}
              ></span>
              {getLineName(connection.lineId)}
            </span>
            <strong>{getStationName(connection.destination)}</strong>
            <span>
              {formatTime(connection.arrival, connection.tzDeltaSeconds)}
            </span>
          {:else}
            <strong>{getStationName(connection.origin)}</strong>
            <span></span>
            <span>
              Walk {Math.round(connection.distanceMeters)} m,
              {formatDuration(connection.duration)}
            </span>
            <strong>{getStationName(connection.destination)}</strong>
            <span></span>
          {/if}
        </li>
      {/each}
    </ol>
  {:else if routeSearched}
    <p>No route found.</p>
  {/if}

  <p>Indexed {connectionCount} connections.</p>

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

  button {
    align-self: end;
    min-height: 38px;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.45rem 0.75rem;
    color: var(--text-h);
    background: var(--bg);
    font: inherit;
    cursor: pointer;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .checkbox-control {
    display: flex;
    gap: 6px;
    align-items: center;
    align-self: end;
    min-height: 38px;
    color: var(--text-h);
    font-size: 14px;
    line-height: 1.2;
  }

  .checkbox-control input {
    width: 16px;
    height: 16px;
  }

  .route-result {
    display: grid;
    gap: 8px;
    max-width: 760px;
    margin: 16px auto;
    padding-left: 24px;
    text-align: left;
  }

  .route-result li {
    display: grid;
    grid-template-columns:
      minmax(140px, 1fr) auto minmax(120px, 1fr) minmax(140px, 1fr)
      auto;
    gap: 8px;
    align-items: baseline;
  }

  .line-label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
  }

  .line-color {
    width: 12px;
    height: 12px;
    border: 1px solid var(--border);
    border-radius: 50%;
    flex: 0 0 auto;
  }
</style>
