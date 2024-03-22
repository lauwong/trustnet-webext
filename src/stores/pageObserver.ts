/* eslint-disable no-console */
import store from '..'
import generalUtils from '~/lib/generalUtils'

export default {
  namespaced: true,
  state: {
    observer: null,
    config: null,
  },
  mutations: {
    setup_observer: (state) => {
      if (state.observer === null) {
        const targetNode = document.body
        state.config = { attributes: false, childList: true, subtree: true }

        const insertedApp = document.querySelector('div[data-vuetify-trustnet]')
        const reheadlineApp = document.querySelector('div[data-vuetify-reheadline]')

        const callback = generalUtils.throttle((mutationsList, observer) => {
          console.log('trustnet going to execute mutation callback **')
          let childMutation = false
          for (const mutation of mutationsList) {
            console.log('mutation detected:', mutation)
            if (mutation.type === 'childList' && !insertedApp.contains(mutation.target)
                  && (!reheadlineApp || !reheadlineApp.contains(mutation.target)))
              childMutation = true
          }
          console.log('trustnet child mutation happened or not:', childMutation)
          if (childMutation) {
            console.log('Trustnet: A child node has been added or removed.')
            state.observer.takeRecords()
            state.observer.disconnect()
            store.dispatch('linkAssessments/setupLinkAssessments', true, { root: true })
          }
        }, 2000)

        state.observer = new MutationObserver(callback)
      }
    },

    disconnect_observer: (state) => {
      state.observer.takeRecords()
      state.observer.disconnect()
    },

    reconnect_observer: (state) => {
      const targetNode = document.body
      state.observer.observe(targetNode, state.config)
    },
  },
  actions: {
    setUpObserver(context) {
      console.log('trustnet observer is set up')
      return new Promise((resolve, reject) => {
        context.commit('setup_observer')
        resolve()
      })
    },

    disconnectObserver(context) {
      return new Promise((resolve, reject) => {
        context.commit('disconnect_observer')
        resolve()
      })
    },

    reconnectObserver(context) {
      return new Promise((resolve, reject) => {
        context.commit('reconnect_observer')
        resolve()
      })
    },

  },
}
