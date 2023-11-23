import Vue from 'vue'
import {Connex} from '@vechain/connex'
import App from './App.vue'
import { TooltipPlugin } from 'bootstrap-vue'

import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

const thor = new Connex.Thor({
    node: 'https://sync-mainnet.veblocks.net',
    network: 'main'
})

Vue.use(TooltipPlugin)
new Vue({
  render: (h) => h(App),
  provide: {
    $thor: thor,
  }
}).$mount('#app')
