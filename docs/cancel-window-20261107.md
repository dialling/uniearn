# Cancel tip and 3-minute window (11.6.2026 feedback)

Customers can cancel a parcel, takeaway, night-market, or any-task order while it is still waiting. After a runner accepts, the same cancel action stays open for **3 minutes** from `takenAt`, then the server rejects it with `Cancel window ended`. Pickup (`collected`) also ends the window. The order page shows one tip under the Cancel order button:

- Before acceptance: `No runner has accepted yet — you can cancel anytime.`
- Inside the window: `A runner has accepted. You can still cancel for 3:00`, with the clock updated every second.
- After the window: the button is disabled and the tip reads `A runner has accepted — cancel window ended.`

A runner returning an order to the hall does **not** cancel it. The order stays `waiting`, remains on the customer’s active list, and the notice says it is still active. `Order cancelled` is only sent when the status is actually `cancelled`.

## Start a trip / group order

`tests/group-order-flow.test.js` covers extracting an existing order into a trip and running a group order. No product change was required for that flow in this pass.
