/* eslint-disable no-console */
export default {
  namespaced: true,
  state() {
    return {
      /*
            articlePreviewTheme
        */
      userPreferences: {},
    }
  },
  mutations: {
    set_preferences: (state, payload) => {
      state.userPreferences = Object.assign({}, payload)
    },
  },
  actions: {
    getUserPreferences: (context) => {
      return new Promise((resolve, reject) => {
        browser.runtime.sendMessage({
          type: 'get_preferences',
        })
          .then((response) => {
            console.log('retrieved user preferences:', response)
            context.commit('set_preferences', response.data)
            resolve()
          }).catch((error) => {
            console.log(error)
            reject(error)
          })
      })
    },
    setUserPreferences: (context, payload) => {
      return new Promise((resolve, reject) => {
        const newPreferences = Object.assign({}, context.state.userPreferences)
        for (const [key, value] of Object.entries(payload))
          newPreferences[key] = value

        browser.runtime.sendMessage({
          type: 'set_preferences',
          data: {
            reqBody: { preferences: JSON.stringify(newPreferences) },
          },
        })
          .then(() => {
            context.dispatch('getUserPreferences')
              .then(() => {
                resolve()
              })
          }).catch((error) => {
            reject(error)
          })
      })
    },

  },
}
