export default {
  namespaced: true,
  state: {
    boosts: [],
  },
  mutations: {
    set_boosts: (state, boosts) => {
      state.boosts = boosts
    },
  },
  actions: {

    boostArticle(context, payload) {
      return new Promise((resolve, reject) => {
        browser.runtime.sendMessage({
          type: 'boost_article',
          data: {
            reqBody: payload,
          },
        })
          .then((response) => {
            resolve(response)
          })
          .catch((err) => {
            console.log(err)
            reject()
          })
      })
    },

  },
}
