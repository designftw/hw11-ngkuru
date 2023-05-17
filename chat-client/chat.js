import * as Vue from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js'
import { mixin } from "https://mavue.mavo.io/mavue.js";
import GraffitiPlugin from 'https://graffiti.garden/graffiti-js/plugins/vue/plugin.js'
import Resolver from './resolver.js'

const app = {
  // Import MaVue
  mixins: [mixin],

  created() {
    // Import resolver
    this.resolver = new Resolver(this.$gf);
  },

  setup() {
    // initialize graffiti
    const $gf = Vue.inject('graffiti');

    // Initialize the name of the channel we're chatting in
    const channel = Vue.ref('default');
    const context = Vue.computed(() => [channel.value]);

    // Initialize the collection of messages associated with the context
    const { objects: messagesRaw } = $gf.useObjects(context);
    const { objects: channelsRaw } = $gf.useObjects(["subscriptions"]);
    return { channel, messagesRaw, channelsRaw };
  },

  data() {
    return {
      // username stuff
      myUsername: '',
      preferredUsername: '',
      usernameResult: '',
      actorsToUsernames: {},
      // routing
      screen: "mainMenu",
      // channel stuff
      defaultChannels: [
        "default",
        "default-demo",
        "test",
      ],
      addingChannel: false,
      preferredChannel: "",
      // task stuff
      addingTask: false,
      preferredTask: "",
      // text stuff
      messageText: "",
      file: null,
      // edit stuff
      editID: "",
      editText: "",
    };
  },

  computed: {
    messages() {
      let messages = this.messagesRaw
        .filter(m =>
          m.type &&
          m.type == 'Note' &&
          (m.content || m.content == '') &&
          typeof m.content == 'string'
        );

      return messages
        .sort((m1, m2) => new Date(m2.published) - new Date(m1.published))
        .slice(0, 50);
    },

    tasks() {
      let tasks = this.messagesRaw
        .filter(m =>
          m.type &&
          m.type == 'Task' &&
          (m.content || m.content == '') &&
          typeof m.content == 'string'
        );

      return tasks
        .sort((m1, m2) => new Date(m2.published) - new Date(m1.published))
        .slice(0, 10);
    },

    savedChannels() {
      let savedChannels = this.channelsRaw
        .filter(m =>
          m.type &&
          m.type == "Subscription" &&
          m.content &&
          typeof m.content == 'string'
        );

      return savedChannels
        .sort((m1, m2) => new Date(m2.published) - new Date(m1.published))
        .slice(0, 10);
    },
  },

  watch: {
    '$gf.me': async function (me) {
      this.myUsername = await this.resolver.actorToUsername(me);
    },

    async messages(messages) {
      for (const m of messages) {
        if (!(m.actor in this.actorsToUsernames)) {
          this.actorsToUsernames[m.actor] = await this.resolver.actorToUsername(m.actor);
        }
      }
    },
  },

  methods: {
    // username stuff
    async setUsername() {
      try {
        this.usernameResult = await this.resolver.requestUsername(this.preferredUsername);
        this.myUsername = this.preferredUsername;
      } catch (e) {
        this.usernameResult = e.toString();
      }
    },

    // channel stuff
    startAddChannel() {
      this.addingChannel = true;
    },

    addChannel() {
      this.addingChannel = false;
      const message = {
        type: 'Subscription',
        content: this.preferredChannel,
        context: ["subscriptions"],
      };
      this.$gf.post(message);
      this.preferredChannel = "";
    },

    cancelAddChannel() {
      this.addingChannel = false;
      this.preferredChannel = "";
    },

    removeChannel(channel) {
      this.$gf.remove(channel);
    },

    // navigation stuff
    enterChannel(channel) {
      this.channel = channel;
      this.screen = "description";
    },

    toMainMenu() {
      this.screen = "mainMenu";
    },

    toDescription() {
      this.screen = "description";
    },

    toChat() {
      this.screen = "chat";
    },

    toProfile() {
      this.screen = "profile";
    },

    // task stuff
    startAddTask() {
      this.addingTask = true;
    },

    addTask() {
      this.addingTask = false;
      const message = {
        type: 'Task',
        content: this.preferredTask,
        context: [this.channel],
      };
      this.$gf.post(message);
      this.preferredTask = "";
    },

    cancelAddTask() {
      this.addingTask = false;
      this.preferredTask = "";
    },

    removeTask(task) {
      this.$gf.remove(task);
    },

    // message stuff
    async sendMessage() {
      const message = {
        type: 'Note',
        content: this.messageText,
      };

      if (this.file) {
        message.attachment = {
          type: 'Image',
          magnet: await this.$gf.media.store(this.file),
        }
        this.file = null;
      }

      message.context = [this.channel];
      this.$gf.post(message);
      this.messageText = "";
    },

    removeMessage(message) {
      this.$gf.remove(message);
    },

    startEditMessage(message) {
      this.editID = message.id;
      this.editText = message.content;
    },

    saveEditMessage(message) {
      message.content = this.editText;
      this.editID = "";
      this.editText = "";
    },

    onImageAttachment(event) {
      const file = event.target.files[0];
      this.file = file;
    },
  },
}

const Name = {
  props: ['actor', 'editable'],

  setup(props) {
    const { actor } = Vue.toRefs(props);
    const $gf = Vue.inject('graffiti');
    return $gf.useObjects([actor]);
  },

  computed: {
    profile() {
      return this.objects
        .filter(m =>
          m.type &&
          m.type == 'Profile' &&
          m.name &&
          typeof m.name == 'string')
        .reduce((prev, curr) => !prev || curr.published > prev.published ? curr : prev, null)
    }
  },

  data() {
    return {
      editing: false,
      editText: ''
    }
  },

  methods: {
    editName() {
      this.editing = true;
      this.editText = this.profile ? this.profile.name : this.editText;
    },

    saveName() {
      if (this.profile) {
        this.profile.name = this.editText;
      } else {
        this.$gf.post({
          type: 'Profile',
          name: this.editText
        });
      }
      this.editing = false;
    },
  },

  template: '#name',
}

const Like = {
  props: ["messageid"],

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    const { objects: likesRaw } = $gf.useObjects([messageid])
    return { likesRaw }
  },

  computed: {
    likes() {
      return this.likesRaw.filter(l =>
        l.type == 'Like' &&
        l.object == this.messageid)
    },

    numLikes() {
      // Unique number of actors
      return [...new Set(this.likes.map(l => l.actor))].length
    },

    myLikes() {
      return this.likes.filter(l => l.actor == this.$gf.me)
    }
  },

  methods: {
    toggleLike() {
      if (this.myLikes.length) {
        this.$gf.remove(...this.myLikes)
      } else {
        this.$gf.post({
          type: 'Like',
          object: this.messageid,
          context: [this.messageid]
        })
      }
    }
  },

  template: '#like'
}

const MagnetImg = {
  props: {
    src: String,
    loading: {
      type: String,
      default: 'https://upload.wikimedia.org/wikipedia/commons/9/92/Loading_icon_cropped.gif'
    },
    error: {
      type: String,
      default: '' // empty string will trigger broken link
    }
  },

  data() {
    return {
      fetchedSrc: ''
    }
  },

  watch: {
    src: {
      async handler(src) {
        this.fetchedSrc = this.loading
        try {
          this.fetchedSrc = await this.$gf.media.fetchURL(src)
        } catch {
          this.fetchedSrc = this.error
        }
      },
      immediate: true
    }
  },

  template: '<img :src="fetchedSrc" style="max-width: 8rem" />'
}

const ProfilePicture = {
  props: {
    actor: {
      type: String
    },
    editable: {
      type: Boolean,
      default: false
    },
    anonymous: {
      type: String,
      default: 'magnet:?xt=urn:btih:58c03e56171ecbe97f865ae9327c79ab3c1d5f16&dn=Anonymous.svg&tr=udp%3A%2F%2Ftracker.leechers-paradise.org%3A6969&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=udp%3A%2F%2Fexplodie.org%3A6969&tr=udp%3A%2F%2Ftracker.empire-js.us%3A1337&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com'
    }
  },

  setup(props) {
    // Get a collection of all objects associated with the actor
    const { actor } = Vue.toRefs(props)
    const $gf = Vue.inject('graffiti')
    return $gf.useObjects([actor])
  },

  computed: {
    profile() {
      return this.objects
        .filter(m =>
          m.type == 'Profile' &&
          m.icon &&
          m.icon.type == 'Image' &&
          typeof m.icon.magnet == 'string')
        .reduce((prev, curr) => !prev || curr.published > prev.published ? curr : prev, null)
    }
  },

  data() {
    return {
      file: null
    }
  },

  methods: {
    async savePicture() {
      if (!this.file) return

      this.$gf.post({
        type: 'Profile',
        icon: {
          type: 'Image',
          magnet: await this.$gf.media.store(this.file)
        }
      })
    },

    onPicture(event) {
      const file = event.target.files[0]
      this.file = file
    }
  },

  template: '#profile-picture'
}

const Replies = {
  props: ["messageid"],

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    return $gf.useObjects([messageid])
  },

  computed: {
    replies() {
      return this.objects.filter(o =>
        o.type == 'Note' &&
        typeof o.content == 'string' &&
        o.inReplyTo == this.messageid)
        .sort((m1, m2) => new Date(m2.published) - new Date(m1.published))
    },
  },

  data() {
    return {
      content: ''
    }
  },

  methods: {
    postReply() {
      if (!this.content) return

      this.$gf.post({
        type: 'Note',
        content: this.content,
        inReplyTo: this.messageid,
        context: [this.messageid]
      })
      this.content = ''
    }
  },

  template: '#replies'
}

const ReadReceipts = {
  props: ["messageid"],

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    return $gf.useObjects([messageid])
  },

  async mounted() {
    if (!(this.readActors.includes(this.$gf.me))) {
      this.$gf.post({
        type: 'Read',
        object: this.messageid,
        context: [this.messageid]
      })
    }
  },

  computed: {
    reads() {
      return this.objects.filter(o =>
        o.type == 'Read' &&
        o.object == this.messageid)
    },

    myReads() {
      return this.reads.filter(r => r.actor == this.$gf.me)
    },

    readActors() {
      return [...new Set(this.reads.map(r => r.actor))]
    }
  },

  watch: {
    // In case we accidentally "read" more than once.
    myReads(myReads) {
      if (myReads.length > 1) {
        // Remove all but one
        this.$gf.remove(...myReads.slice(1))
      }
    }
  },

  template: '#read-receipts'
}

Vue.createApp(app)
  .component('name', Name)
  .component('like', Like)
  .component('magnet-img', MagnetImg)
  .component('profile-picture', ProfilePicture)
  .component('replies', Replies)
  .component('read-receipts', ReadReceipts)
  .use(GraffitiPlugin(Vue))
  .mount('#app')
