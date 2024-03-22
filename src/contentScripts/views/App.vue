<script>
import assessmentsContainer from '~/components/AssessmentsContainer'
import setupHelpers from '~/mixins/setupHelpers'
import pageDetails from '~/stores/pageDetails'

export default {
  name: 'InsertedApp',
  components: {
    AssessmentsContainer: assessmentsContainer,
  },
  mixins: [setupHelpers],
  data: () => ({
    authUser: null,
  }),
  computed: {
    isLoggedIn() {
      return auth.getters.isLoggedIn
    },
    isBlacklisted() {
      return pageDetails.isBlacklisted
    },
  },
  created() {
    this.getUser()
      .then((authUser) => {
      // this.logout();
        this.authUser = authUser
        if (!authUser) {
          this.logout()
          this.$router.push({ name: 'Login' })
        }
        else {
          console.log('alan authUser chie', authUser)
          this.fetchRelationships()
          this.fetchPageAndUserCharacteristics()
            .then(() => {
              if (!this.isBlacklisted) {
                this.getPageAssessments()
                this.getUnfollowedAssessors()
                this.setupLinkAssessments()
              }
            })
        }

        this.setTimeOpened()
      })
  },
  methods: {
    ...mapActions('auth', [
      'getUser',
      'logout',
    ]),
    ...mapActions('assessments', [
      'getPageAssessments',
      'getUnfollowedAssessors',
    ]),
    ...mapActions('linkAssessments', [
      'setupLinkAssessments',
    ]),
    ...mapActions('pageDetails', [
      'setTimeOpened',
    ]),
  },
}
</script>

<template>
  <v-app>
    <router-view />
    <AssessmentsContainer v-if="isLoggedIn & !isBlacklisted" />
  </v-app>
</template>

<style>
/* html {
   min-height: initial;
   min-width: initial;
   z-index: 9999999;
} */
</style>
