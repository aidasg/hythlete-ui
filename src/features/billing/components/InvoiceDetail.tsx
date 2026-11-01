import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BillingError, billingDate, getInvoice, money } from "@/features/billing/services/billingApi";
import { paths } from "@/routes/paths";
export function InvoiceDetail() {
  const { id } = useParams();
  const invoiceID = Number(id);
  const validID = Number.isSafeInteger(invoiceID) && invoiceID > 0;
  const query = useQuery({ queryKey: ["billing", "invoice", invoiceID], queryFn: () => getInvoice(invoiceID), enabled: validID, retry: false });
  const invoice = query.data;
  return <section className="billing-workspace invoice-workspace"><div className="invoice-controls"><Link to={paths.billing}>Back to billing</Link>{invoice && <button className="secondary-button" onClick={() => window.print()}>Print / Save as PDF</button>}</div>
    {query.isPending && validID && <p role="status">Loading invoice...</p>}
    {!validID || query.error instanceof BillingError && query.error.status === 404 ? <p role="alert">Invoice not found.</p> : query.error && <p role="alert">{query.error.message} <button onClick={() => void query.refetch()}>Retry</button></p>}
    {invoice && <article className="billing-card invoice-document"><header><h1>Invoice {invoice.number}</h1>{invoice.simulated && <p className="invoice-simulated">Simulated invoice. No money was charged.</p>}<p>{invoice.status} · Issued {billingDate(invoice.created_at)}</p></header>
      <h2>Billed to</h2><p>{invoice.billing_name}<br />{invoice.billing_email}</p>
      {invoice.billing_address && Object.values(invoice.billing_address).map((value, index) => <p key={index}>{value}</p>)}
      {invoice.tax_id && <p>Tax ID: {invoice.tax_id}</p>}
      <p>Service period: {billingDate(invoice.period_start)} – {billingDate(invoice.period_end)}</p>
      <div className="billing-table-wrap"><table><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{invoice.lines?.map((line, index) => <tr key={index}><td>{line.description}</td><td>{line.quantity}</td><td>{money(line.unit_amount, invoice.currency)}</td><td>{money(line.amount, invoice.currency)}</td></tr>)}</tbody></table></div>
      <dl className="invoice-totals"><div><dt>Subtotal</dt><dd>{money(invoice.subtotal, invoice.currency)}</dd></div><div><dt>Tax</dt><dd>{money(invoice.tax, invoice.currency)}</dd></div><div><dt>Total</dt><dd>{money(invoice.total, invoice.currency)}</dd></div></dl>
      <p>Payment provider: {invoice.provider}{invoice.simulated ? " (simulated)" : ""}</p>
    </article>}
  </section>;
}
