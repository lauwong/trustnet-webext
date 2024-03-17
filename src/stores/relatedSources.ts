/* eslint-disable no-console */
import utils from '@/services/utils'
export default {
  namespaced: true,
  state: {
    followedSources: [],
    trustedSources: [],
    followers: [],
  },
  getters: {
    trustedIds: (state) => {
      return state.trustedSources.map(source => source.id)
    },
    followedIds: (state) => {
      return state.followedSources.map(source => source.id)
    },
    followedOrTrusteds: (state) => {
      const allSources = []
      for (const key of [state.followedSources, state.trustedSources]) {
        key.forEach((source) => {
          const index = allSources.findIndex(el => el.id === source.id)
          if (index === -1) {
            const newSource = Object.assign({}, source)
            allSources.push(newSource)
          }
        })
      }
      return allSources
    },

  },
  mutations: {

    populate_follows: (state, sources) => {
      sources.sort(utils.compareSources)
      state.followedSources = sources
    },
    populate_trusteds: (state, sources) => {
      sources.sort(utils.compareSources)
      state.trustedSources = sources
    },
    populate_followers: (state, sources) => {
      sources.sort(utils.compareSources)
      state.followers = sources
    },
    add_source_to_list: (state, payload) => {
      const list = payload.list // one of followedSources, trustedSources, or followers

      let lowIndex = 0
      let highIndex = list.length

      while (lowIndex < highIndex) {
        const midIndex = (lowIndex + highIndex) >>> 1
        if (utils.compareSources(list[midIndex], payload.source) < 0)
          lowIndex = midIndex + 1
        else
          highIndex = midIndex
      }

      const insertionIndex = lowIndex
      list.splice(insertionIndex, 0, payload.source)
    },
  },
  actions: {
    fetchFollows: (context) => {
      return new Promise((resolve, reject) => {
        browser.runtime.sendMessage({
          type: 'get_follows',
        })
          .then((response) => {
            context.commit('populate_follows', response)
            resolve()
          })
          .catch((err) => {
            console.log(err)
            reject(err)
          })
      })
    },

    fetchTrusteds: (context) => {
      return new Promise((resolve, reject) => {
        browser.runtime.sendMessage({
          type: 'get_trusteds',
        })
          .then((response) => {
            context.commit('populate_trusteds', response)
            resolve()
          })
          .catch((err) => {
            console.log(err)
            reject(err)
          })
      })
    },

    /*
    Followers are used in the assessmentContainer component
    where there is also a place for sharing the article with
    one's followers
    */
    fetchFollowers: (context) => {
      return new Promise((resolve, reject) => {
        browser.runtime.sendMessage({
          type: 'get_followers',
        })
          .then((response) => {
            context.commit('populate_followers', response)
            resolve()
          })
          .catch((err) => {
            console.log(err)
            reject(err)
          })
      })
    },

    /*
    Called in the UnfollowedAssessors component, when the user follows a source
    */
    addSourceToFollows: (context, payload) => {
      context.commit('add_source_to_list',
        {
          source: payload,
          list: context.state.followedSources,
        })
    },

  },

}
