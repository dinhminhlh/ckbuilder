import { useEffect, useState } from 'react'
import { ccc } from '@ckb-ccc/ccc'
import { useCcc, useSigner } from '@ckb-ccc/connector-react'
import './App.css'

function App() {
  const { open, disconnect, wallet } = useCcc()
  const signer = useSigner()

  const [network, setNetwork] = useState('Loading...')
  const [address, setAddress] = useState('')
  const [balance, setBalance] = useState('--')

  const [queryAddress, setQueryAddress] = useState('')
  const [queriedBalance, setQueriedBalance] = useState<string | null>(null)

  const [cells, setCells] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])

  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)

  // -------------------------
  // Network
  // -------------------------

  useEffect(() => {
    const client = new ccc.ClientPublicTestnet()

    setNetwork(
      client.addressPrefix === 'ckt'
        ? 'CKB Testnet'
        : 'Unknown',
    )
  }, [])

  // -------------------------
  // Wallet
  // -------------------------

  useEffect(() => {
    async function loadWallet() {
      if (!signer) {
        setAddress('')
        setBalance('--')
        return
      }

      try {
        const addr = await signer.getRecommendedAddress()
        const balanceValue = await signer.getBalance()

        setAddress(addr)
        setBalance(
          ccc.fixedPointToString(balanceValue),
        )
      } catch (error) {
        console.error(error)
      }
    }

    loadWallet()
  }, [signer])

  // -------------------------
  // Query Balance
  // -------------------------

  async function queryBalance() {
    if (!queryAddress.trim()) {
      setStatus('Enter a CKB Testnet address.')
      return
    }

    try {
      setLoading(true)
      setStatus('')

      const client = new ccc.ClientPublicTestnet()

      const { script: lock } =
        await ccc.Address.fromString(
          queryAddress.trim(),
          client,
        )

      const value = await client.getBalance([lock])

      setQueriedBalance(
        ccc.fixedPointToString(value),
      )
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : String(error),
      )
    } finally {
      setLoading(false)
    }
  }

  // -------------------------
  // Query Cells
  // -------------------------

  async function queryCells() {
    if (!queryAddress.trim()) {
      setStatus('Enter a CKB Testnet address.')
      return
    }

    try {
      setLoading(true)
      setStatus('')
      setCells([])

      const client = new ccc.ClientPublicTestnet()

      const { script: lock } =
        await ccc.Address.fromString(
          queryAddress.trim(),
          client,
        )

      const result: any[] = []

      for await (
        const cell of client.findCellsByLock(lock)
      ) {
        result.push(cell)

        if (result.length >= 10) break
      }

      setCells(result)

      if (result.length === 0) {
        setStatus('No live cells found.')
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : String(error),
      )
    } finally {
      setLoading(false)
    }
  }

  // -------------------------
  // Query Transactions
  // -------------------------

  async function queryTransactions() {
    if (!queryAddress.trim()) {
      setStatus('Enter a CKB Testnet address.')
      return
    }

    try {
      setLoading(true)
      setStatus('')
      setTransactions([])

      const client = new ccc.ClientPublicTestnet()

      const { script: lock } =
        await ccc.Address.fromString(
          queryAddress.trim(),
          client,
        )

      const result: any[] = []

      for await (
        const tx of client.findTransactionsByLock(
          lock,
          null,
          true,
        )
      ) {
        result.push(tx)

        if (result.length >= 10) break
      }

      setTransactions(result)

      if (result.length === 0) {
        setStatus('No transactions found.')
      }
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : String(error),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container">

      <header>
        <h1>CKB Learning dApp</h1>

        <p>
          Network: <strong>{network}</strong>
        </p>
      </header>

      {/* WALLET */}

      <section className="card">
        <h2>Wallet</h2>

        <p>
          Wallet:{' '}
          <strong>
            {wallet?.name ?? 'Not connected'}
          </strong>
        </p>

        <p>
          Address:
        </p>

        <code>
          {address || 'Not connected'}
        </code>

        <p>
          Balance:
        </p>

        <strong>
          {balance} CKB
        </strong>

        <div className="buttons">
          {!wallet ? (
            <button onClick={open}>
              Connect Wallet
            </button>
          ) : (
            <button onClick={disconnect}>
              Disconnect
            </button>
          )}
        </div>
      </section>

      {/* QUERY */}

      <section className="card">
        <h2>Query Testnet Address</h2>

        <input
          value={queryAddress}
          onChange={(e) =>
            setQueryAddress(e.target.value)
          }
          placeholder="ckt1..."
        />

        <div className="buttons">
          <button
            onClick={queryBalance}
            disabled={loading}
          >
            Query Balance
          </button>

          <button
            onClick={queryCells}
            disabled={loading}
          >
            Query Cells
          </button>

          <button
            onClick={queryTransactions}
            disabled={loading}
          >
            Query Transactions
          </button>
        </div>

        {queriedBalance !== null && (
          <div className="result">
            Balance: <strong>
              {queriedBalance} CKB
            </strong>
          </div>
        )}

        {status && (
          <p className="status">
            {status}
          </p>
        )}
      </section>

      {/* CELLS */}

      <section className="card">
        <h2>
          Live Cells ({cells.length})
        </h2>

        {cells.map((cell, index) => (
          <div className="item" key={index}>
            <strong>
              Cell #{index + 1}
            </strong>

            <p>
              Capacity:{' '}
              {ccc.fixedPointToString(
                cell.cellOutput.capacity,
              )}{' '}
              CKB
            </p>

            <p>
              Tx Hash:
            </p>

            <code>
              {cell.outPoint.txHash}
            </code>

            <p>
              Index:{' '}
              {cell.outPoint.index.toString()}
            </p>
          </div>
        ))}
      </section>

      {/* TRANSACTIONS */}

      <section className="card">
        <h2>
          Transactions ({transactions.length})
        </h2>

        {transactions.map((tx, index) => (
          <div className="item" key={index}>
            <strong>
              Transaction #{index + 1}
            </strong>

            <p>
              Tx Hash:
            </p>

            <code>
              {tx.txHash}
            </code>

            <p>
              Block: {tx.blockNumber.toString()}
            </p>
          </div>
        ))}
      </section>

    </main>
  )
}

export default App