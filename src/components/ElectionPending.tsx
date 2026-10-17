export default function ElectionPending({year,primary=false}:{year:number;primary?:boolean}) {
    return <section className="election-pending" role="status">
        <h2>{primary?'Partisan primary':'November election'} {year}</h2>
        <p>The county has not published this election in its results feed yet.</p>
        <p>This view will connect automatically when it appears. Checks run every 30 seconds.</p>
    </section>;
}
