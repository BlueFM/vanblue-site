+++
title = "PaperScorer —— 中稿到底可不可预测？"
description = "上传匿名化的投稿 PDF，返回中稿概率估计；模型读页面图像，用 OpenReview 与 arXiv 的评审训练。"
date = 2026-10-29
weight = 1

[extra]
url = "https://paperscorer-ai.com/"
tags = ["同行评审", "视觉模型", "科研工具"]
+++

作者是 Sachin Konan、Jonathan Liu、Zhuang Liu（普林斯顿），NeurIPS 2026。

PaperScorer 收一份匿名化的投稿 PDF，给出一个中稿概率估计——一个数字，加三档标签之一
（Leans Reject / Leans Accept / Likely Accept）。模型读的是页面图像，所以图表和版式也算数。

真正让它值得留在收藏夹里的，是作者的提法：中稿这件事本身有多可预测。每次预测都附一个页面，
说明这个数字该信多少，论文也是公开的。这样用，它就是给稿子做一次廉价体检——提醒你这篇读
起来偏薄——而不是替你决定投不投。

两点要注意。PDF 是传到别人服务器上的，请只传匿名版、只传你愿意公开的内容。另外站方自己也提
示，当前排队的稿件很多，出结果会慢一些。

→ [paperscorer-ai.com](https://paperscorer-ai.com/)
