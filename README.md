# TxManager [![GitHub Workflow Status](https://img.shields.io/github/workflow/status/tornadocash/tx-manager/build)](https://github.com/tornadocash/tx-manager/actions) [![npm](https://img.shields.io/npm/v/tx-manager)](https://www.npmjs.com/package/tx-manager)

Transaction manager that assumes that it has exclusive access to an address and submits one transaction at a time

Will try to bump gas price or resubmit transaction when needed, ensuring that tx is eventually mined
