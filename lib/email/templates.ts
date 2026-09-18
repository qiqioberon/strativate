export type PaidInvoiceEmailPayload = {
  invoiceNumber: string
  orderId: string
  paidAt: string | null
  buyer: { name?: string | null; email: string }
  items: Array<{ id?: string; kind: string; name: string; slug?: string; unitPriceAmount: number }>
  subtotalAmount: number
  totalAmount: number
  currencyCode: string
  payment?: { provider?: string | null; method?: string | null; transactionReference?: string | null }
}

export function escapeEmailHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function formatInvoiceRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function brandedEmail(input: {
  eyebrow: string
  heading: string
  intro: string
  body: string
  cta: { label: string; href: string }
  note: string
}) {
  return `<!doctype html><html><body style="margin:0;background:#f6f3ef;font-family:Arial,Helvetica,sans-serif;color:#27364a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f3ef;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #eadfd7;border-radius:16px"><tr><td style="padding:28px 32px 18px"><div style="font-size:18px;font-weight:800;letter-spacing:.08em;color:#111">STRATIVATE</div><div style="margin-top:24px;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#d75a00">${escapeEmailHtml(input.eyebrow)}</div><h1 style="margin:8px 0 10px;font-size:26px;line-height:1.25;color:#111">${escapeEmailHtml(input.heading)}</h1><p style="margin:0;color:#625a55;font-size:14px;line-height:1.65">${escapeEmailHtml(input.intro)}</p></td></tr><tr><td style="padding:0 32px 24px">${input.body}</td></tr><tr><td style="padding:8px 32px 28px"><a href="${escapeEmailHtml(input.cta.href)}" style="display:inline-block;background:#ff7a00;color:#fff;text-decoration:none;font-weight:700;font-size:14px;line-height:20px;padding:12px 18px;border-radius:10px">${escapeEmailHtml(input.cta.label)}</a></td></tr><tr><td style="padding:0 32px 26px"><p style="margin:0;padding:14px 16px;border-radius:10px;background:#fff8f0;color:#625a55;font-size:12px;line-height:1.6">${escapeEmailHtml(input.note)}</p></td></tr><tr><td style="padding:20px 32px;border-top:1px solid #eee6df;color:#81756e;font-size:11px;line-height:1.6">Butuh bantuan? Gunakan kanal dukungan resmi Strativate.<br/>© Strativate</td></tr></table></td></tr></table></body></html>`
}

export function renderPaidInvoiceEmail(payload: PaidInvoiceEmailPayload, appUrl: string) {
  const paidAt = payload.paidAt
    ? new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(payload.paidAt))
    : 'Pembayaran terverifikasi'

  const rows = payload.items.map(item => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee6df">
        <strong style="display:block;font-size:13px;color:#27364a">${escapeEmailHtml(item.name)}</strong>
        <span style="font-size:11px;color:#81756e">${escapeEmailHtml(item.kind.replaceAll('_', ' '))}</span>
      </td>
      <td align="right" style="padding:10px 0;border-bottom:1px solid #eee6df;font-size:13px;font-weight:700">
        ${escapeEmailHtml(formatInvoiceRupiah(item.unitPriceAmount))}
      </td>
    </tr>`).join('')

  const method = [payload.payment?.provider, payload.payment?.method].filter(Boolean).join(' · ') || 'Pembayaran online'
  const reference = payload.payment?.transactionReference
    ? `<div style="margin-top:6px"><span style="color:#81756e">Referensi transaksi</span><br/><strong>${escapeEmailHtml(payload.payment.transactionReference)}</strong></div>`
    : ''

  const body = `
    <div style="padding:18px;border:1px solid #eee6df;border-radius:12px;background:#fffdfa">
      <table role="presentation" width="100%">
        <tr><td style="font-size:12px;color:#81756e">Status</td><td align="right"><strong style="color:#157347;font-size:12px">LUNAS</strong></td></tr>
        <tr><td colspan="2" style="padding-top:12px"><strong style="font-size:17px">${escapeEmailHtml(payload.invoiceNumber)}</strong><div style="margin-top:4px;color:#81756e;font-size:11px">Order ${escapeEmailHtml(payload.orderId)} · ${escapeEmailHtml(paidAt)}</div></td></tr>
      </table>
    </div>
    <div style="margin-top:18px"><p style="margin:0 0 8px;font-size:12px;color:#81756e">Pembeli</p><strong style="font-size:13px">${escapeEmailHtml(payload.buyer.name || 'Mentee Strativate')}</strong><br/><span style="font-size:12px;color:#625a55">${escapeEmailHtml(payload.buyer.email)}</span></div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px">
      ${rows}
      <tr><td style="padding-top:12px;font-size:12px;color:#81756e">Subtotal</td><td align="right" style="padding-top:12px;font-size:13px">${escapeEmailHtml(formatInvoiceRupiah(payload.subtotalAmount))}</td></tr>
      <tr><td style="padding-top:7px;font-weight:800">Total</td><td align="right" style="padding-top:7px;font-size:16px;font-weight:800">${escapeEmailHtml(formatInvoiceRupiah(payload.totalAmount))}</td></tr>
    </table>
    <div style="margin-top:18px;font-size:12px;line-height:1.55"><span style="color:#81756e">Metode pembayaran</span><br/><strong>${escapeEmailHtml(method)}</strong>${reference}</div>`

  const dashboardUrl = new URL('/dashboard', appUrl).href
  const html = brandedEmail({
    eyebrow: 'Invoice Strativate',
    heading: 'Pembayaran berhasil',
    intro: 'Pembayaran Anda sudah terverifikasi. Berikut ringkasan invoice untuk pesanan Strativate.',
    body,
    cta: { label: 'Buka dashboard', href: dashboardUrl },
    note: 'Simpan email ini sebagai bukti pembayaran. Akses produk atau program mengikuti entitlement pada pesanan yang sudah lunas.',
  })

  const itemText = payload.items.map(item => `- ${item.name}: ${formatInvoiceRupiah(item.unitPriceAmount)}`).join('\n')
  const text = `STRATIVATE\n\nPembayaran berhasil\nInvoice: ${payload.invoiceNumber}\nOrder: ${payload.orderId}\nTanggal: ${paidAt}\nPembeli: ${payload.buyer.name || 'Mentee Strativate'} <${payload.buyer.email}>\n\n${itemText}\n\nSubtotal: ${formatInvoiceRupiah(payload.subtotalAmount)}\nTotal: ${formatInvoiceRupiah(payload.totalAmount)}\nMetode: ${method}${payload.payment?.transactionReference ? `\nReferensi: ${payload.payment.transactionReference}` : ''}\n\nDashboard: ${dashboardUrl}`

  return {
    subject: `Pembayaran berhasil · ${payload.invoiceNumber}`,
    html,
    text,
  }
}
