import Vue from 'vue'
import {Connex} from '@vechain/connex'
import App from './App.vue'
import { TooltipPlugin } from 'bootstrap-vue'

import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue/dist/bootstrap-vue.css'

const NODE_URL = 'https://mainnet.vechain.org'

const thor = new Connex.Thor({
    node: NODE_URL,
    network: 'main'
})

Vue.use(TooltipPlugin)
new Vue({
  render: (h) => h(App),
  provide: {
    $thor: thor,
    $nodeUrl: NODE_URL,
  }
}).$mount('#app')
