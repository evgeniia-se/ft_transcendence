//Owner: Track 4 (Whiteboard, notes, and supporting modules)
//Responsible for: the Terms of Service page — mandatory, non-placeholder, reachable via footer link per the general requirements.

import type { LegalSection, LegalVersions } from "./legalDoc";

const SECTIONS_EN: LegalSection[] = [
	{
		title: "1. What this service is",
		paragraphs: [
			"ft_transcendence is a collaborative project workspace — boards, cards, notes, whiteboards, files and Git integration — built as a student project at 42 Paris.",
			"It is provided as-is, for free, with no guarantee of any kind. By using it you accept these terms. If you do not accept them, do not create an account.",
		],
	},
	{
		title: "2. Who may use it",
		paragraphs: [
			"You must be at least 15 years old.",
			"You need one account per person. Do not share an account, and do not create an account for someone else.",
		],
	},
	{
		title: "3. Your account",
		paragraphs: [
			"You are responsible for keeping your password safe and for everything that happens under your account.",
			"If you think someone else has access to your account, change your password immediately and tell the team running the instance.",
		],
	},
	{
		title: "4. What you may not do",
		paragraphs: [
			"Do not upload content that is illegal, that infringes someone else's rights, or that contains someone else's personal data without their agreement.",
			"Do not upload malware, and do not use the service to attack it or anything else — no attempts to break authentication, no automated scraping, no deliberate overloading.",
			"Do not try to access projects you were not invited to, or data belonging to other users.",
			"Respect the upload limits: 10 MB per file, and only images, PDF, plain text, Markdown, JSON and ZIP files. They exist so the service stays usable for everyone.",
		],
	},
	{
		title: "5. Your content",
		paragraphs: [
			"Everything you create here stays yours. We claim no ownership over your notes, drawings, cards, or files.",
			"You give us permission to store your content and show it to the other members of the projects you put it in. That is the only permission we need, and we use it for nothing else.",
			"You are responsible for having the right to upload what you upload.",
		],
	},
	{
		title: "6. Projects and membership",
		paragraphs: [
			"A project owner or administrator can invite members and remove them. If you are removed from a project, you lose access to its content.",
			"Content you created inside a shared project belongs to that project. It stays there when you leave, so the rest of the team is not left with holes in their work.",
		],
	},
	{
		title: "7. API keys",
		paragraphs: [
			"Project administrators can create API keys to access a project programmatically. A key only gives access to the project it was created for. Anything done with your key counts as done by you, so keep your keys private and revoke any key you no longer use.",
			"API requests are rate-limited. Keys that are used abusively may be revoked.",
		],
	},
	{
		title: "8. GitHub integration",
		paragraphs: [
			"If you sign in with GitHub or link a card to a repository, you also accept GitHub's own terms. Only link repositories you are allowed to use, and only add the project's webhook to repositories you administer.",
			"You can revoke the application's access at any time from your GitHub settings. Cards already linked keep their last known status.",
		],
	},
	{
		title: "9. Availability and data loss",
		paragraphs: [
			"We do not promise that the service will be available, that it will keep working, or that your data will survive. It may go down without notice, and data may be lost.",
			"This is a school project, not a backed-up production system. Keep your own copy of anything you cannot afford to lose.",
		],
	},
	{
		title: "10. Ending your use",
		paragraphs: [
			"You can delete your account at any time from your settings. What happens to your data when you do is described in the Privacy Policy.",
			"We may suspend or remove an account that breaks these terms, or that puts the service or its other users at risk.",
		],
	},
	{
		title: "11. No warranty, no liability",
		paragraphs: [
			"The service is provided without warranty of any kind, express or implied.",
			"To the extent the law allows, the people who built and run this project are not liable for any damage, loss of data, or loss of any kind arising from your use of it.",
		],
	},
	{
		title: "12. Governing law",
		paragraphs: [
			"These terms are governed by French law. Any dispute falls to the competent courts in France.",
		],
	},
	{
		title: "13. Changes to these terms",
		paragraphs: [
			"We may update these terms. When we do, we will change the date at the top of this page. Continuing to use the service after a change means you accept the new terms.",
		],
	},
	{
		title: "14. Contact",
		paragraphs: [
			"Questions about these terms can be sent to the team that runs this instance. For the original project, that is the 42 Paris students listed in the repository README.",
		],
	},
];

const SECTIONS_FR: LegalSection[] = [
	{
		title: "1. Ce qu'est ce service",
		paragraphs: [
			"ft_transcendence est un espace de travail collaboratif — tableaux, cartes, notes, tableaux blancs, fichiers et intégration Git — réalisé comme projet étudiant à 42 Paris.",
			"Il est fourni tel quel, gratuitement, sans aucune garantie. En l'utilisant, vous acceptez ces conditions. Si vous ne les acceptez pas, ne créez pas de compte.",
		],
	},
	{
		title: "2. Qui peut l'utiliser",
		paragraphs: [
			"Vous devez avoir au moins 15 ans.",
			"Un compte correspond à une personne. Ne partagez pas votre compte, et n'en créez pas pour quelqu'un d'autre.",
		],
	},
	{
		title: "3. Votre compte",
		paragraphs: [
			"Vous êtes responsable de la confidentialité de votre mot de passe et de tout ce qui se passe avec votre compte.",
			"Si vous pensez que quelqu'un d'autre a accès à votre compte, changez immédiatement votre mot de passe et prévenez l'équipe qui gère l'instance.",
		],
	},
	{
		title: "4. Ce qui est interdit",
		paragraphs: [
			"N'envoyez pas de contenu illégal, qui porte atteinte aux droits d'autrui, ou qui contient les données personnelles de quelqu'un sans son accord.",
			"N'envoyez pas de logiciel malveillant, et n'utilisez pas le service pour l'attaquer ou attaquer autre chose — pas de tentative de contourner l'authentification, pas d'aspiration automatisée, pas de surcharge volontaire.",
			"N'essayez pas d'accéder aux projets auxquels vous n'avez pas été invité, ni aux données des autres utilisateurs.",
			"Respectez les limites d'envoi : 10 Mo par fichier, et uniquement des images, PDF, textes, Markdown, JSON et ZIP. Elles existent pour que le service reste utilisable par tous.",
		],
	},
	{
		title: "5. Votre contenu",
		paragraphs: [
			"Tout ce que vous créez ici vous appartient. Nous ne revendiquons aucun droit sur vos notes, dessins, cartes ou fichiers.",
			"Vous nous autorisez à stocker votre contenu et à le montrer aux autres membres des projets où vous le placez. C'est la seule autorisation dont nous avons besoin, et nous ne l'utilisons pour rien d'autre.",
			"Vous êtes responsable d'avoir le droit d'envoyer ce que vous envoyez.",
		],
	},
	{
		title: "6. Projets et membres",
		paragraphs: [
			"Le propriétaire ou un administrateur d'un projet peut inviter des membres et les retirer. Si vous êtes retiré d'un projet, vous perdez l'accès à son contenu.",
			"Le contenu que vous créez dans un projet partagé appartient à ce projet. Il y reste quand vous partez, pour que le reste de l'équipe ne se retrouve pas avec des trous dans son travail.",
		],
	},
	{
		title: "7. Clés API",
		paragraphs: [
			"Les administrateurs d'un projet peuvent créer des clés API pour y accéder depuis un programme. Une clé ne donne accès qu'au projet pour lequel elle a été créée. Tout ce qui est fait avec votre clé est considéré comme fait par vous : gardez vos clés privées et révoquez celles que vous n'utilisez plus.",
			"Les requêtes à l'API sont limitées en débit. Une clé utilisée de façon abusive peut être révoquée.",
		],
	},
	{
		title: "8. Intégration GitHub",
		paragraphs: [
			"Si vous vous connectez avec GitHub ou liez une carte à un dépôt, vous acceptez aussi les conditions de GitHub. Ne liez que des dépôts que vous avez le droit d'utiliser, et n'ajoutez le webhook du projet qu'à des dépôts que vous administrez.",
			"Vous pouvez retirer l'accès de l'application à tout moment depuis vos réglages GitHub. Les cartes déjà liées gardent leur dernier statut connu.",
		],
	},
	{
		title: "9. Disponibilité et perte de données",
		paragraphs: [
			"Nous ne promettons pas que le service sera disponible, qu'il continuera de fonctionner, ni que vos données seront conservées. Il peut s'arrêter sans préavis, et des données peuvent être perdues.",
			"C'est un projet d'école, pas un système de production sauvegardé. Gardez votre propre copie de tout ce que vous ne pouvez pas vous permettre de perdre.",
		],
	},
	{
		title: "10. Fin de l'utilisation",
		paragraphs: [
			"Vous pouvez supprimer votre compte à tout moment depuis vos paramètres. Ce qu'il advient alors de vos données est décrit dans la politique de confidentialité.",
			"Nous pouvons suspendre ou supprimer un compte qui enfreint ces conditions, ou qui met en danger le service ou ses autres utilisateurs.",
		],
	},
	{
		title: "11. Absence de garantie et de responsabilité",
		paragraphs: [
			"Le service est fourni sans garantie d'aucune sorte, expresse ou implicite.",
			"Dans la mesure permise par la loi, les personnes qui ont réalisé et qui font fonctionner ce projet ne sont pas responsables des dommages, pertes de données ou pertes de toute nature liés à son utilisation.",
		],
	},
	{
		title: "12. Droit applicable",
		paragraphs: [
			"Ces conditions sont régies par le droit français. Tout litige relève des tribunaux compétents en France.",
		],
	},
	{
		title: "13. Modification de ces conditions",
		paragraphs: [
			"Nous pouvons mettre à jour ces conditions. Dans ce cas, nous changerons la date en haut de cette page. Continuer à utiliser le service après une modification vaut acceptation des nouvelles conditions.",
		],
	},
	{
		title: "14. Contact",
		paragraphs: [
			"Les questions sur ces conditions peuvent être adressées à l'équipe qui gère cette instance. Pour le projet d'origine, ce sont les étudiants de 42 Paris listés dans le README du dépôt.",
		],
	},
];

const SECTIONS_JA: LegalSection[] = [
	{
		title: "1. このサービスについて",
		paragraphs: [
			"ft_transcendence は、ボード、カード、ノート、ホワイトボード、ファイル、Git 連携を備えた共同作業スペースで、42 Paris の学生プロジェクトとして作られました。",
			"本サービスは現状のまま無料で提供され、いかなる保証もありません。利用することで本規約に同意したものとみなされます。同意しない場合は、アカウントを作成しないでください。",
		],
	},
	{
		title: "2. 利用できる人",
		paragraphs: [
			"15 歳以上である必要があります。",
			"アカウントは 1 人につき 1 つです。アカウントを共有したり、他人のためにアカウントを作成したりしないでください。",
		],
	},
	{
		title: "3. あなたのアカウント",
		paragraphs: [
			"パスワードを安全に管理すること、およびあなたのアカウントで行われるすべてのことについて、あなたが責任を負います。",
			"他人があなたのアカウントにアクセスできると思われる場合は、すぐにパスワードを変更し、インスタンスを運営するチームに知らせてください。",
		],
	},
	{
		title: "4. 禁止事項",
		paragraphs: [
			"違法なコンテンツ、他人の権利を侵害するコンテンツ、本人の同意なく他人の個人データを含むコンテンツをアップロードしないでください。",
			"マルウェアをアップロードしたり、本サービスやその他のものを攻撃するために本サービスを利用したりしないでください。認証の突破の試み、自動化されたスクレイピング、意図的な過負荷は禁止です。",
			"招待されていないプロジェクトや、他のユーザーのデータにアクセスしようとしないでください。",
			"アップロードの制限を守ってください：1 ファイルあたり 10 MB まで、画像、PDF、プレーンテキスト、Markdown、JSON、ZIP ファイルのみです。これはサービスを全員が使える状態に保つための制限です。",
		],
	},
	{
		title: "5. あなたのコンテンツ",
		paragraphs: [
			"ここで作成したものはすべてあなたのものです。私たちはあなたのノート、図、カード、ファイルの所有権を主張しません。",
			"あなたは、あなたのコンテンツを保存し、それを置いたプロジェクトの他のメンバーに表示する許可を私たちに与えます。私たちに必要な許可はこれだけで、それ以外の目的には使いません。",
			"アップロードするものについて、アップロードする権利を持っていることはあなたの責任です。",
		],
	},
	{
		title: "6. プロジェクトとメンバー",
		paragraphs: [
			"プロジェクトのオーナーまたは管理者は、メンバーを招待したり外したりできます。プロジェクトから外されると、そのコンテンツにアクセスできなくなります。",
			"共有プロジェクト内で作成したコンテンツはそのプロジェクトに属します。チームの他のメンバーの作業に穴が開かないよう、あなたが抜けた後もプロジェクトに残ります。",
		],
	},
	{
		title: "7. API キー",
		paragraphs: [
			"プロジェクトの管理者は、プログラムからプロジェクトにアクセスするための API キーを作成できます。キーは、作成されたプロジェクトにのみアクセスできます。あなたのキーで行われたことはあなたが行ったものとみなされるため、キーは非公開にし、使わなくなったキーは取り消してください。",
			"API リクエストにはレート制限があります。不正に使用されたキーは取り消される場合があります。",
		],
	},
	{
		title: "8. GitHub 連携",
		paragraphs: [
			"GitHub でログインしたり、カードをリポジトリに紐づけたりする場合、GitHub 自身の規約にも同意することになります。使用を許可されたリポジトリだけを紐づけ、プロジェクトの Webhook は自分が管理するリポジトリにだけ追加してください。",
			"アプリケーションのアクセス権は、GitHub の設定からいつでも取り消せます。すでに紐づいたカードは、最後に確認されたステータスを保持します。",
		],
	},
	{
		title: "9. 可用性とデータの消失",
		paragraphs: [
			"本サービスが利用可能であること、動作し続けること、あなたのデータが保持されることは約束しません。予告なく停止することがあり、データが失われることもあります。",
			"これは学校のプロジェクトであり、バックアップのある本番システムではありません。失いたくないものは、必ずご自身でもコピーを保管してください。",
		],
	},
	{
		title: "10. 利用の終了",
		paragraphs: [
			"設定からいつでもアカウントを削除できます。その際のデータの扱いは、プライバシーポリシーに記載されています。",
			"本規約に違反するアカウントや、サービスや他のユーザーを危険にさらすアカウントは、停止または削除することがあります。",
		],
	},
	{
		title: "11. 無保証・免責",
		paragraphs: [
			"本サービスは、明示または黙示を問わず、いかなる保証もなく提供されます。",
			"法律で認められる範囲において、本プロジェクトを作成・運営する者は、本サービスの利用に起因するいかなる損害、データの消失、その他の損失についても責任を負いません。",
		],
	},
	{
		title: "12. 準拠法",
		paragraphs: [
			"本規約はフランス法に準拠します。紛争はフランスの管轄裁判所が扱います。",
		],
	},
	{
		title: "13. 本規約の変更",
		paragraphs: [
			"本規約は更新されることがあります。その場合は、このページ上部の日付を変更します。変更後もサービスを利用し続けることで、新しい規約に同意したものとみなされます。",
		],
	},
	{
		title: "14. お問い合わせ",
		paragraphs: [
			"本規約に関するご質問は、このインスタンスを運営するチームにお送りください。元のプロジェクトについては、リポジトリの README に記載された 42 Paris の学生です。",
		],
	},
];

const SECTIONS_RU: LegalSection[] = [
	{
		title: "1. Что это за сервис",
		paragraphs: [
			"ft_transcendence — это пространство для совместной работы над проектами (доски, карточки, заметки, интерактивные доски, файлы и интеграция с Git), созданное как студенческий проект в 42 Paris.",
			"Сервис предоставляется бесплатно, «как есть», без каких-либо гарантий. Пользуясь им, вы принимаете эти условия. Если вы их не принимаете, не создавайте аккаунт.",
		],
	},
	{
		title: "2. Кто может пользоваться сервисом",
		paragraphs: [
			"Вам должно быть не менее 15 лет.",
			"Один аккаунт — на одного человека. Не передавайте свой аккаунт другим и не создавайте аккаунт за кого-то другого.",
		],
	},
	{
		title: "3. Ваш аккаунт",
		paragraphs: [
			"Вы отвечаете за сохранность своего пароля и за всё, что происходит в вашем аккаунте.",
			"Если вы считаете, что кто-то другой получил доступ к вашему аккаунту, немедленно смените пароль и сообщите команде, которая обслуживает этот сервер.",
		],
	},
	{
		title: "4. Что запрещено",
		paragraphs: [
			"Не загружайте незаконный контент, контент, нарушающий чужие права, или контент с чужими персональными данными без согласия этих людей.",
			"Не загружайте вредоносное ПО и не используйте сервис для атак на него или на что-либо ещё: никаких попыток обойти аутентификацию, автоматического сбора данных или намеренной перегрузки.",
			"Не пытайтесь получить доступ к проектам, в которые вас не приглашали, или к данным других пользователей.",
			"Соблюдайте ограничения на загрузку: не более 10 МБ на файл и только изображения, PDF, простой текст, Markdown, JSON и ZIP. Они нужны, чтобы сервис оставался доступным для всех.",
		],
	},
	{
		title: "5. Ваш контент",
		paragraphs: [
			"Всё, что вы здесь создаёте, остаётся вашим. Мы не претендуем на ваши заметки, рисунки, карточки или файлы.",
			"Вы разрешаете нам хранить ваш контент и показывать его другим участникам проектов, в которые вы его поместили. Это единственное разрешение, которое нам нужно, и мы не используем его ни для чего другого.",
			"Вы отвечаете за то, что у вас есть право загружать то, что вы загружаете.",
		],
	},
	{
		title: "6. Проекты и участники",
		paragraphs: [
			"Владелец или администратор проекта может приглашать участников и удалять их. Если вас удалили из проекта, вы теряете доступ к его содержимому.",
			"Контент, созданный вами в общем проекте, принадлежит этому проекту. Он остаётся там после вашего ухода, чтобы в работе остальной команды не появились пробелы.",
		],
	},
	{
		title: "7. Ключи API",
		paragraphs: [
			"Администраторы проекта могут создавать ключи API для программного доступа к проекту. Ключ даёт доступ только к тому проекту, для которого он создан. Всё, что сделано с помощью вашего ключа, считается сделанным вами, поэтому храните ключи в тайне и отзывайте те, которыми больше не пользуетесь.",
			"Частота запросов к API ограничена. Ключи, используемые со злоупотреблениями, могут быть отозваны.",
		],
	},
	{
		title: "8. Интеграция с GitHub",
		paragraphs: [
			"Если вы входите через GitHub или связываете карточку с репозиторием, вы также принимаете условия самого GitHub. Связывайте только те репозитории, которыми вам разрешено пользоваться, и добавляйте webhook проекта только в репозитории, которые вы администрируете.",
			"Вы можете в любой момент отозвать доступ приложения в настройках GitHub. Уже связанные карточки сохранят последний известный статус.",
		],
	},
	{
		title: "9. Доступность и потеря данных",
		paragraphs: [
			"Мы не обещаем, что сервис будет доступен, что он продолжит работать или что ваши данные сохранятся. Он может остановиться без предупреждения, а данные могут быть потеряны.",
			"Это учебный проект, а не производственная система с резервным копированием. Храните собственную копию всего, что вы не можете позволить себе потерять.",
		],
	},
	{
		title: "10. Прекращение использования",
		paragraphs: [
			"Вы можете удалить свой аккаунт в любой момент в настройках. Что при этом происходит с вашими данными, описано в политике конфиденциальности.",
			"Мы можем приостановить или удалить аккаунт, который нарушает эти условия или создаёт угрозу для сервиса или других пользователей.",
		],
	},
	{
		title: "11. Отказ от гарантий и ответственности",
		paragraphs: [
			"Сервис предоставляется без каких-либо гарантий, явных или подразумеваемых.",
			"В пределах, допускаемых законом, люди, которые создали этот проект и обслуживают его, не несут ответственности за любой ущерб, потерю данных или иные потери, связанные с использованием сервиса.",
		],
	},
	{
		title: "12. Применимое право",
		paragraphs: [
			"Эти условия регулируются правом Франции. Любые споры рассматриваются компетентными судами Франции.",
		],
	},
	{
		title: "13. Изменение условий",
		paragraphs: [
			"Мы можем обновлять эти условия. В этом случае мы изменим дату в начале этой страницы. Продолжая пользоваться сервисом после изменений, вы принимаете новые условия.",
		],
	},
	{
		title: "14. Контакты",
		paragraphs: [
			"Вопросы об этих условиях можно направлять команде, которая обслуживает этот сервер. Для исходного проекта это студенты 42 Paris, перечисленные в README репозитория.",
		],
	},
];

const SECTIONS_ZH: LegalSection[] = [
	{
		title: "1. 本服务是什么",
		paragraphs: [
			"ft_transcendence 是一个协作式项目工作空间——包括看板、卡片、笔记、白板、文件和 Git 集成——作为 42 Paris 的学生项目开发。",
			"本服务按原样免费提供，不作任何形式的保证。使用本服务即表示你接受这些条款。如果你不接受，请不要创建账户。",
		],
	},
	{
		title: "2. 谁可以使用",
		paragraphs: [
			"你必须年满 15 岁。",
			"每人只能拥有一个账户。不要共享账户，也不要替他人创建账户。",
		],
	},
	{
		title: "3. 你的账户",
		paragraphs: [
			"你有责任妥善保管你的密码，并对你账户下发生的一切负责。",
			"如果你认为有他人能够访问你的账户，请立即修改密码，并告知运行该实例的团队。",
		],
	},
	{
		title: "4. 禁止行为",
		paragraphs: [
			"不得上传违法内容、侵犯他人权利的内容，或未经本人同意包含他人个人数据的内容。",
			"不得上传恶意软件，也不得利用本服务攻击本服务或其他任何对象——禁止尝试破解身份验证、自动化抓取或故意造成过载。",
			"不得试图访问你未被邀请的项目，或属于其他用户的数据。",
			"请遵守上传限制：每个文件最大 10 MB，且仅限图片、PDF、纯文本、Markdown、JSON 和 ZIP 文件。这些限制是为了让所有人都能正常使用本服务。",
		],
	},
	{
		title: "5. 你的内容",
		paragraphs: [
			"你在这里创建的一切仍归你所有。我们不主张对你的笔记、绘图、卡片或文件的任何所有权。",
			"你允许我们存储你的内容，并向你放置内容的项目中的其他成员展示。这是我们唯一需要的许可，我们不会将其用于任何其他目的。",
			"你有责任确保你有权上传你所上传的内容。",
		],
	},
	{
		title: "6. 项目与成员",
		paragraphs: [
			"项目所有者或管理员可以邀请和移除成员。如果你被移出项目，你将无法再访问其内容。",
			"你在共享项目中创建的内容属于该项目。你离开后这些内容仍会保留，以免团队其他成员的工作出现缺失。",
		],
	},
	{
		title: "7. API 密钥",
		paragraphs: [
			"项目管理员可以创建 API 密钥，以便通过程序访问项目。密钥只能访问为其创建的项目。使用你的密钥所做的一切都视为你本人所为，因此请妥善保管你的密钥，并撤销不再使用的密钥。",
			"API 请求有速率限制。被滥用的密钥可能会被撤销。",
		],
	},
	{
		title: "8. GitHub 集成",
		paragraphs: [
			"如果你使用 GitHub 登录或将卡片关联到仓库，你也同时接受 GitHub 自身的条款。只关联你有权使用的仓库，并且只在你管理的仓库中添加项目的 Webhook。",
			"你可以随时在 GitHub 设置中撤销本应用的访问权限。已关联的卡片会保留其最后已知的状态。",
		],
	},
	{
		title: "9. 可用性与数据丢失",
		paragraphs: [
			"我们不承诺本服务始终可用、持续运行，或你的数据一定会被保留。服务可能在没有通知的情况下中断，数据也可能丢失。",
			"这是一个学校项目，而不是有备份的生产系统。对于你不能承受丢失的任何内容，请自行保留副本。",
		],
	},
	{
		title: "10. 停止使用",
		paragraphs: [
			"你可以随时在设置中删除你的账户。届时你的数据将如何处理，请参阅隐私政策。",
			"对于违反这些条款，或对本服务及其他用户造成风险的账户，我们可能会暂停或删除。",
		],
	},
	{
		title: "11. 无担保、免责",
		paragraphs: [
			"本服务不提供任何明示或默示的担保。",
			"在法律允许的范围内，开发和运营本项目的人员不对因使用本服务而产生的任何损害、数据丢失或任何其他损失承担责任。",
		],
	},
	{
		title: "12. 适用法律",
		paragraphs: [
			"这些条款受法国法律管辖。任何争议均由法国有管辖权的法院处理。",
		],
	},
	{
		title: "13. 条款的变更",
		paragraphs: [
			"我们可能会更新这些条款。届时我们会修改本页顶部的日期。变更后继续使用本服务即表示你接受新的条款。",
		],
	},
	{
		title: "14. 联系方式",
		paragraphs: [
			"有关这些条款的问题，可以发送给运行该实例的团队。对于原始项目，即仓库 README 中列出的 42 Paris 学生。",
		],
	},
];

export const termsOfService: LegalVersions = {
	en: { title: "Terms of Service", updated: "Last updated: 20 October 2026", sections: SECTIONS_EN },
	fr: { title: "Conditions d'utilisation", updated: "Dernière mise à jour : 20 octobre 2026", sections: SECTIONS_FR },
	ja: { title: "利用規約", updated: "最終更新日：2026 年 10 月 20 日", sections: SECTIONS_JA },
	ru: { title: "Условия использования", updated: "Последнее обновление: 20 октября 2026 г.", sections: SECTIONS_RU },
	zh: { title: "使用条款", updated: "最后更新：2026 年 10 月 20 日", sections: SECTIONS_ZH },
};
