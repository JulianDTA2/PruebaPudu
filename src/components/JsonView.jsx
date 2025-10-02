export default function JsonView({ data, className = '' }) {
  return (
    <pre
      className={`card-response ${className} `}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
